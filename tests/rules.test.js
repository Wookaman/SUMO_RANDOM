'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sumo = require('./load.js');

const R = Sumo.rules;
const { MOVES, ARENA } = Sumo.CONFIG;
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('ring-out only when the whole body is below the line', () => {
  assert.equal(R.isRingOut(94, 94), false);
  assert.equal(R.isRingOut(94.1, 94), true);
  assert.equal(R.isRingOut(60, 94), false);
});

test('the first wrestler out loses; both out in the same step is a replay', () => {
  assert.equal(R.resolveBout({ 1: false, 2: false }), null);
  assert.deepEqual(R.resolveBout({ 1: true, 2: false }), { type: 'point', winner: 2, loser: 1 });
  assert.deepEqual(R.resolveBout({ 1: false, 2: true }), { type: 'point', winner: 1, loser: 2 });
  assert.deepEqual(R.resolveBout({ 1: true, 2: true }), { type: 'replay' });
});

test('addPoint returns a new score', () => {
  const before = { 1: 2, 2: 3 };
  assert.deepEqual(R.addPoint(before, 1), { 1: 3, 2: 3 });
  assert.deepEqual(before, { 1: 2, 2: 3 });
});

test('first to 5 points wins the match', () => {
  assert.equal(R.matchWinner({ 1: 4, 2: 4 }, 5), 0);
  assert.equal(R.matchWinner({ 1: 5, 2: 4 }, 5), 1);
  assert.equal(R.matchWinner({ 1: 2, 2: 5 }, 5), 2);
});

test('wrestlers face each other, and keep facing when on top of each other', () => {
  assert.equal(R.facingToward(100, 140, -1), 1);
  assert.equal(R.facingToward(140, 100, 1), -1);
  assert.equal(R.facingToward(100, 100.2, -1), -1);
});

test('normalizeAngle folds into (-PI, PI]', () => {
  close(R.normalizeAngle(3 * Math.PI), Math.PI);
  close(R.normalizeAngle(-Math.PI), Math.PI);
  close(R.normalizeAngle(2 * Math.PI + 0.1), 0.1);
  close(R.normalizeAngle(-0.3), -0.3);
});

test('an upright charge goes forward and 25 degrees up', () => {
  const e = MOVES.chargeElevation;
  const right = R.chargeDirection(0, 1, e);
  close(right.x, Math.cos(e));
  close(right.y, -Math.sin(e));
  const left = R.chargeDirection(0, -1, e);
  close(left.x, -Math.cos(e));
  close(left.y, -Math.sin(e));
});

test('a charge follows the lean: lying on your back launches you up and backwards', () => {
  const e = MOVES.chargeElevation;
  const d = R.chargeDirection(-Math.PI / 2, 1, e); // facing right, rotated onto its back
  close(d.x, -Math.sin(e));
  close(d.y, -Math.cos(e));
});

test('a face-down charge drives into the floor', () => {
  const d = R.chargeDirection(Math.PI / 2, 1, MOVES.chargeElevation);
  assert.ok(d.y > 0);
});

test('upright pull pushes back toward upright and is clamped', () => {
  const cfg = { maxAngle: 1, stiffness: 60, damping: 12, maxTorque: 40 };
  close(R.uprightTorque(0, 0, cfg), 0);
  assert.ok(R.uprightTorque(0.3, 0, cfg) < 0);
  assert.ok(R.uprightTorque(-0.3, 0, cfg) > 0);
  assert.equal(R.uprightTorque(0.9, 0, cfg), -40);
  assert.ok(R.uprightTorque(0, 2, cfg) < 0); // damping resists spinning
});

test('upright pull gives up on a fallen wrestler', () => {
  const cfg = { maxAngle: 1, stiffness: 60, damping: 12, maxTorque: 40 };
  assert.equal(R.uprightTorque(1.2, 0, cfg), 0);
  assert.equal(R.uprightTorque(-Math.PI / 2, 0, cfg), 0);
  assert.ok(R.uprightTorque(2 * Math.PI + 0.2, 0, cfg) < 0); // uses the folded angle
});

test('belly bump adds separation speed only for real hits', () => {
  const cfg = { boost: 0.8, minSpeed: 2 };
  assert.equal(R.bellyBumpSpeed(1.5, cfg), 0);
  close(R.bellyBumpSpeed(10, cfg), 8);
});

test('the winner dances on the ring if standing on it, otherwise on the floor', () => {
  assert.deepEqual(R.danceSpot(120, ARENA.ringTop - 12, ARENA), { x: 120, groundY: ARENA.ringTop });
  assert.deepEqual(R.danceSpot(20, ARENA.floorY - 12, ARENA), { x: 20, groundY: ARENA.floorY });
  assert.deepEqual(R.danceSpot(ARENA.ringX0 + 2, ARENA.ringTop + 5, ARENA), { x: ARENA.ringX0 + 2, groundY: ARENA.floorY });
  assert.deepEqual(R.danceSpot(-50, ARENA.floorY - 12, ARENA), { x: -50, groundY: ARENA.floorY });
});
