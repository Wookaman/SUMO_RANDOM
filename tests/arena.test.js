'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sumo = require('./load.js');

const A = Sumo.arena;
const { PHYSICS, ARENA, WRESTLER } = Sumo.CONFIG;

function steps(arena, n) {
  for (let i = 0; i < n; i++) A.step(arena, PHYSICS.dt);
}

function bodyCount(world) {
  let n = 0;
  for (let b = world.getBodyList(); b; b = b.getNext()) n++;
  return n;
}

test('an empty arena has no ring-outs and nobody landed', () => {
  const arena = A.create();
  assert.deepEqual(A.ringOuts(arena), { 1: false, 2: false });
  assert.equal(A.bothLanded(arena), false);
  assert.equal(A.parts(arena, 1), null);
});

test('plop-in drops both wrestlers from above the screen onto their start marks', () => {
  const arena = A.create();
  A.resetBout(arena);
  assert.ok(Sumo.wrestler.topY(arena.wrestlers[1]) < 0);
  assert.equal(A.facing(arena, 1), 1);
  assert.equal(A.facing(arena, 2), -1);
  let t = 0;
  while (!A.bothLanded(arena) && t < 3) {
    A.step(arena, PHYSICS.dt);
    t += PHYSICS.dt;
  }
  assert.ok(t >= 0.5 && t <= 1.2, `landing took ${t}s`);
  assert.deepEqual(A.ringOuts(arena), { 1: false, 2: false });
  assert.ok(Math.abs(A.bellyPos(arena, 1).x - ARENA.startX[1]) < 3);
  assert.ok(Math.abs(A.bellyPos(arena, 2).x - ARENA.startX[2]) < 3);
});

test('resetBout replaces the old wrestlers instead of adding more', () => {
  const arena = A.create();
  A.resetBout(arena);
  const n = bodyCount(arena.world);
  A.resetBout(arena);
  assert.equal(bodyCount(arena.world), n);
});

test('a wrestler standing on the floor is out; one standing on the ring is not', () => {
  const arena = A.create();
  A.spawn(arena, 1, 20, ARENA.floorY - WRESTLER.feetY - 1, 1);
  A.spawn(arena, 2, 140, ARENA.ringTop - WRESTLER.feetY - 1, -1);
  assert.deepEqual(A.ringOuts(arena), { 1: true, 2: false });
});

// Two wrestlers in mid-air (no floor friction) flying belly-first at each other.
function separationAfterHit(boost, speed) {
  const arena = A.create({ bellyBump: { boost, minSpeed: 2 } });
  const y = ARENA.ringTop - 50;
  A.spawn(arena, 1, 100, y, 1);
  A.spawn(arena, 2, 140, y, -1);
  for (const [p, vx] of [[1, speed], [2, -speed]]) {
    for (const b of Object.values(arena.wrestlers[p].bodies)) b.setLinearVelocity({ x: vx, y: 0 });
  }
  let best = -Infinity;
  for (let i = 0; i < 20; i++) {
    A.step(arena, PHYSICS.dt);
    const v1 = arena.wrestlers[1].bodies.belly.getLinearVelocity().x;
    const v2 = arena.wrestlers[2].bodies.belly.getLinearVelocity().x;
    best = Math.max(best, v2 - v1);
  }
  return best;
}

test('a belly bump throws wrestlers apart much harder than a plain collision', () => {
  const plain = separationAfterHit(0, 6);
  const bump = separationAfterHit(0.8, 6);
  assert.ok(bump > plain + 5, `plain ${plain}, bump ${bump}`);
});

test('a gentle belly touch gets no extra push', () => {
  const plain = separationAfterHit(0, 0.5);
  const bump = separationAfterHit(0.8, 0.5);
  assert.ok(Math.abs(bump - plain) < 0.01, `plain ${plain}, bump ${bump}`);
});

test('charge only works for a landed wrestler', () => {
  const arena = A.create();
  A.resetBout(arena);
  assert.equal(A.charge(arena, 1), false);
  steps(arena, 90);
  assert.equal(A.isLanded(arena, 1), true);
  assert.equal(A.charge(arena, 1), true);
  assert.equal(A.charge(arena, 2), true);
});
