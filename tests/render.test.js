'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sumo = require('./load.js');

const { pixels: P, render, dance } = Sumo;
const { W, H, ARENA, COLORS, BUTTONS } = Sumo.CONFIG;

function readyView(extra = {}) {
  return {
    state: 'ready',
    score: { 1: 0, 2: 0 },
    ready: { 1: false, 2: true },
    wrestlers: [
      { player: 1, facing: 1, squash: 0, parts: dance.standing(ARENA.startX[1], ARENA.ringTop, 1) },
      { player: 2, facing: -1, squash: 0, parts: dance.standing(ARENA.startX[2], ARENA.ringTop, -1) },
    ],
    overlay: null,
    showRematch: false,
    ...extra,
  };
}

function has(buf, color) {
  return buf.px.includes(color);
}

function inkInRows(buf, y0, y1) {
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < buf.w; x++) if (P.get(buf, x, y) === COLORS.ink) n++;
  return n;
}

test('the title screen shows the name and START, and no ring', () => {
  const buf = P.makeBuf(W, H);
  render.frame(buf, { state: 'title' });
  assert.ok(inkInRows(buf, 40, 55) > 0);
  assert.equal(P.get(buf, BUTTONS.start.x + 1, BUTTONS.start.y + 1), COLORS.ink);
  assert.equal(P.get(buf, 120, ARENA.ringTop + 10), null);
});

test('the ring, its ring-out band and the floor are drawn', () => {
  const buf = P.makeBuf(W, H);
  render.frame(buf, readyView());
  assert.equal(P.get(buf, 120, ARENA.ringTop + 3), COLORS.ring);
  assert.equal(P.get(buf, 120, ARENA.ringOutY), COLORS.ink);
  assert.equal(P.get(buf, 120, ARENA.ringOutY + 1), COLORS.ink);
  assert.equal(P.get(buf, 10, ARENA.floorY), COLORS.ink);
  assert.equal(P.get(buf, ARENA.startX[1], ARENA.ringTop), COLORS.ink); // ring top edge sits under the feet
});

test('each wrestler wears its own mawashi colour and has a grey outline', () => {
  const both = P.makeBuf(W, H);
  render.frame(both, readyView());
  assert.ok(has(both, COLORS.red));
  assert.ok(has(both, COLORS.blue));
  assert.ok(has(both, COLORS.line));
  const onlyRed = P.makeBuf(W, H);
  render.frame(onlyRed, readyView({ wrestlers: readyView().wrestlers.slice(0, 1) }));
  assert.ok(!has(onlyRed, COLORS.blue));
});

test('the nose is on the side the wrestler faces', () => {
  const parts = dance.standing(100, ARENA.ringTop, 1);
  const buf = P.makeBuf(W, H);
  render.drawWrestler(buf, parts, 1, 1, 0);
  const row = Math.floor(parts.head.y + 0.8);
  assert.equal(P.get(buf, 104, row), COLORS.ink);
  assert.notEqual(P.get(buf, 95, row), COLORS.ink);
});

test('score, ready labels, overlay text and REMATCH are drawn when asked', () => {
  const plain = P.makeBuf(W, H);
  render.frame(plain, readyView({ state: 'fight' }));
  assert.ok(inkInRows(plain, 4, 14) > 0); // score
  assert.equal(inkInRows(plain, 30, 40), 0);

  const ready = P.makeBuf(W, H);
  render.frame(ready, readyView());
  assert.ok(inkInRows(ready, ARENA.ringTop - 44, ARENA.ringTop - 39) > 0);

  const go = P.makeBuf(W, H);
  render.frame(go, readyView({ state: 'fight', overlay: 'GO!' }));
  assert.ok(inkInRows(go, 30, 40) > 0);

  const rematch = P.makeBuf(W, H);
  render.frame(rematch, readyView({ state: 'victory', showRematch: true }));
  assert.equal(P.get(rematch, BUTTONS.rematch.x + 1, BUTTONS.rematch.y + 1), COLORS.ink);
});
