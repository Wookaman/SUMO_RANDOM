'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sumo = require('./load.js');

const M = Sumo.match;
const { TIMING } = Sumo.CONFIG;

function toFight(m) {
  M.clickStart(m);
  M.press(m, 1);
  M.press(m, 2);
  M.landed(m);
}

function winBout(m, winner) {
  M.boutResult(m, { type: 'point', winner, loser: 3 - winner });
  M.tick(m, TIMING.linger);
  if (m.state === 'plop') M.landed(m);
}

test('a new match waits on the title screen at 0 - 0 and ignores keys', () => {
  const m = M.create();
  assert.equal(m.state, 'title');
  assert.deepEqual(m.score, { 1: 0, 2: 0 });
  assert.equal(M.press(m, 1), null);
});

test('START opens the ready check; clicking again does nothing', () => {
  const m = M.create();
  assert.equal(M.clickStart(m), true);
  assert.equal(m.state, 'ready');
  assert.equal(M.clickStart(m), false);
});

test('the match starts once both players are ready, and nobody can un-ready', () => {
  const m = M.create();
  M.clickStart(m);
  assert.equal(M.press(m, 1), 'ready');
  assert.equal(M.press(m, 1), null);
  assert.deepEqual(m.ready, { 1: true, 2: false });
  assert.equal(m.state, 'ready');
  assert.equal(M.press(m, 2), 'ready');
  assert.equal(m.state, 'plop');
});

test('keys do nothing during the plop-in; GO! shows when both land, then keys charge', () => {
  const m = M.create();
  M.clickStart(m);
  M.press(m, 1);
  M.press(m, 2);
  assert.equal(M.press(m, 1), null);
  M.landed(m);
  assert.equal(m.state, 'fight');
  assert.equal(M.overlayText(m), 'GO!');
  assert.equal(M.press(m, 2), 'charge');
  M.tick(m, TIMING.go);
  assert.equal(M.overlayText(m), null);
});

test('landed is ignored outside the plop-in', () => {
  const m = M.create();
  M.landed(m);
  assert.equal(m.state, 'title');
});

test('a point shows RED +1, lingers 1.5s with keys off, then the next plop-in', () => {
  const m = M.create();
  toFight(m);
  M.boutResult(m, { type: 'point', winner: 1, loser: 2 });
  assert.equal(m.state, 'point');
  assert.deepEqual(m.score, { 1: 1, 2: 0 });
  assert.equal(M.overlayText(m), 'RED +1');
  assert.equal(M.press(m, 1), null);
  M.tick(m, TIMING.linger - 0.1);
  assert.equal(m.state, 'point');
  M.tick(m, 0.1);
  assert.equal(m.state, 'plop');
});

test('BLUE +1 for player 2', () => {
  const m = M.create();
  toFight(m);
  M.boutResult(m, { type: 'point', winner: 2, loser: 1 });
  assert.equal(M.overlayText(m), 'BLUE +1');
});

test('a replay changes no score', () => {
  const m = M.create();
  toFight(m);
  M.boutResult(m, { type: 'replay' });
  assert.deepEqual(m.score, { 1: 0, 2: 0 });
  assert.equal(M.overlayText(m), 'REPLAY');
  M.tick(m, TIMING.linger);
  assert.equal(m.state, 'plop');
});

test('bout results are ignored outside a fight, and null results are ignored', () => {
  const m = M.create();
  M.clickStart(m);
  M.boutResult(m, { type: 'point', winner: 1, loser: 2 });
  assert.deepEqual(m.score, { 1: 0, 2: 0 });
  const f = M.create();
  toFight(f);
  M.boutResult(f, null);
  assert.equal(f.state, 'fight');
});

test('first to 5 wins; REMATCH appears after 2s and resets everything', () => {
  const m = M.create();
  toFight(m);
  for (let i = 0; i < 4; i++) winBout(m, 2);
  winBout(m, 1);
  M.boutResult(m, { type: 'point', winner: 2, loser: 1 });
  M.tick(m, TIMING.linger);
  assert.equal(m.state, 'victory');
  assert.equal(m.winner, 2);
  assert.deepEqual(m.score, { 1: 1, 2: 5 });
  assert.equal(M.clickStart(m), false);
  M.tick(m, TIMING.rematchDelay);
  assert.equal(m.rematchVisible, true);
  assert.equal(M.clickStart(m), true);
  assert.equal(m.state, 'ready');
  assert.deepEqual(m.score, { 1: 0, 2: 0 });
  assert.deepEqual(m.ready, { 1: false, 2: false });
  assert.equal(m.winner, 0);
  assert.equal(m.rematchVisible, false);
});
