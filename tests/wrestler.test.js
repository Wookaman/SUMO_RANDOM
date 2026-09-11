'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sumo = require('./load.js');

const { planck } = globalThis;
const { PHYSICS, MOVES, WRESTLER } = Sumo.CONFIG;
const W = Sumo.wrestler;
const GROUND = 100; // pixels

function worldWithGround() {
  const world = new planck.World({ gravity: { x: 0, y: PHYSICS.gravity } });
  const ground = world.createBody({ type: 'static', position: { x: 12, y: (GROUND + 10) / 10 } });
  ground.createFixture(new planck.Box(50, 1), { friction: 0.8 });
  return world;
}

function run(world, seconds, beforeStep) {
  for (let t = 0; t < seconds; t += PHYSICS.dt) {
    if (beforeStep) beforeStep();
    world.step(PHYSICS.dt, PHYSICS.velocityIterations, PHYSICS.positionIterations);
  }
}

function standing(facing = 1) {
  const world = worldWithGround();
  const w = W.create(world, 1, 120, GROUND - WRESTLER.feetY - 1, facing);
  run(world, 1, () => W.update(w, PHYSICS.dt, null, true));
  return { world, w };
}

function bodyCount(world) {
  let n = 0;
  for (let b = world.getBodyList(); b; b = b.getNext()) n++;
  return n;
}

test('parts start where the skeleton says, in pixels', () => {
  const world = worldWithGround();
  const w = W.create(world, 1, 120, 50, 1);
  const p = W.parts(w);
  assert.deepEqual(Object.keys(p).sort(), ['armF', 'armN', 'belly', 'head', 'legF', 'legN']);
  assert.ok(Math.abs(p.belly.x - 120) < 1e-9 && Math.abs(p.belly.y - 50) < 1e-9);
  assert.ok(Math.abs(p.head.y - (50 + WRESTLER.head.y)) < 1e-9);
  assert.ok(Math.abs(p.legN.x - (120 + WRESTLER.leg.hipX)) < 1e-9);
  assert.ok(Math.abs(p.legF.x - (120 - WRESTLER.leg.hipX)) < 1e-9);
});

test('topY is the top of the head', () => {
  const world = worldWithGround();
  const w = W.create(world, 1, 120, 50, 1);
  assert.ok(Math.abs(W.topY(w) - (50 + WRESTLER.head.y - WRESTLER.head.r)) < 0.01);
});

test("a wrestler's own parts never touch each other", () => {
  const { world } = standing();
  for (let c = world.getContactList(); c; c = c.getNext()) {
    const a = c.getFixtureA().getUserData();
    const b = c.getFixtureB().getUserData();
    assert.ok(!(a && b && a.player === b.player), `${a && a.part} touched ${b && b.part}`);
  }
});

test('a dropped wrestler lands and stays standing with the upright pull', () => {
  const { world, w } = standing();
  assert.equal(W.isGrounded(w), true);
  run(world, 3, () => W.update(w, PHYSICS.dt, null, true));
  assert.ok(Math.abs(Sumo.rules.normalizeAngle(w.bodies.belly.getAngle())) < 0.35);
  assert.equal(W.isGrounded(w), true);
});

test('charging in mid-air does nothing', () => {
  const world = worldWithGround();
  const w = W.create(world, 1, 120, 10, 1);
  assert.equal(W.charge(w), false);
  const v = w.bodies.belly.getLinearVelocity();
  assert.equal(v.x, 0);
  assert.equal(v.y, 0);
});

test('a standing charge throws the wrestler forward and up', () => {
  for (const facing of [1, -1]) {
    const { w } = standing(facing);
    assert.equal(W.charge(w), true);
    const v = w.bodies.belly.getLinearVelocity();
    assert.ok(Math.sign(v.x) === facing, `facing ${facing}: vx ${v.x}`);
    assert.ok(v.y < 0);
  }
});

test('during a charge the arms swing back, then the pose ends', () => {
  const { world, w } = standing(1);
  W.charge(w);
  run(world, 0.15, () => W.update(w, PHYSICS.dt, null, true));
  assert.ok(w.joints.shoulderN.getJointAngle() > 0.3, `arm angle ${w.joints.shoulderN.getJointAngle()}`);
  run(world, MOVES.chargePoseTime, () => W.update(w, PHYSICS.dt, null, true));
  assert.equal(w.poseTimer, 0);
});

test('a wrestler turns to face the other one', () => {
  const { w } = standing(1);
  W.update(w, PHYSICS.dt, 60, true);
  assert.equal(w.facing, -1);
  W.update(w, PHYSICS.dt, null, true);
  assert.equal(w.facing, -1);
});

test('destroy removes all six bodies', () => {
  const world = worldWithGround();
  const before = bodyCount(world);
  const w = W.create(world, 2, 120, 50, -1);
  assert.equal(bodyCount(world), before + 6);
  W.destroy(world, w);
  assert.equal(bodyCount(world), before);
});
