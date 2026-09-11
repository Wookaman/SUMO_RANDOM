'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sumo = require('./load.js');

const { W, H, ARENA, WRESTLER, KEYS } = Sumo.CONFIG;

test('screen is 240x135', () => {
  assert.equal(W, 240);
  assert.equal(H, 135);
});

test('ring is two thirds of the screen wide', () => {
  assert.equal(ARENA.ringX1 - ARENA.ringX0, (W * 2) / 3);
});

test('ring-out line is one head-height below the ring top', () => {
  assert.equal(ARENA.ringOutY - ARENA.ringTop, WRESTLER.head.r * 2);
});

test('a wrestler standing on the floor is fully below the ring-out line', () => {
  assert.ok(ARENA.floorY - WRESTLER.standHeight > ARENA.ringOutY);
});

test('start marks sit either side of the ring centre', () => {
  const mid = (ARENA.ringX0 + ARENA.ringX1) / 2;
  assert.ok(ARENA.startX[1] < mid);
  assert.equal(mid - ARENA.startX[1], ARENA.startX[2] - mid);
});

test('player 1 is W and player 2 is the up arrow', () => {
  assert.deepEqual(KEYS, { KeyW: 1, ArrowUp: 2 });
});
