'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sumo = require('./load.js');

const D = Sumo.dance;
const G = Sumo.CONFIG.WRESTLER;
const GROUND = 86;

function limbEnd(part, hh) {
  // far end of a limb box: centre + rotate(a) * (0, hh)
  return { x: part.x - Math.sin(part.a) * hh, y: part.y + Math.cos(part.a) * hh };
}

test('standing puts the belly over the spot and the feet on the ground', () => {
  const p = D.standing(100, GROUND, 1);
  assert.ok(Math.abs(p.belly.x - 100) < 1e-9);
  assert.ok(Math.abs(p.belly.y - (GROUND - G.feetY)) < 1e-9);
  for (const leg of [p.legN, p.legF]) assert.ok(Math.abs(limbEnd(leg, G.leg.hh).y - GROUND) < 0.2);
});

test('standing mirrors with facing', () => {
  const right = D.standing(100, GROUND, 1);
  const left = D.standing(100, GROUND, -1);
  assert.ok(Math.abs(right.legN.x - (100 + G.leg.hipX)) < 0.5); // legs are slightly apart, so the centre is a little off the hip
  assert.ok(Math.abs(left.legN.x - (100 - G.leg.hipX)) < 0.5);
  assert.ok(Math.abs(right.armN.a + left.armN.a) < 1e-9);
  assert.ok(right.armN.a < 0); // near arm rests slightly forward (toward +x)
});

test('on the beat the arms are up in the air and the wrestler hops', () => {
  const p = D.victory(100, GROUND, 1, 0.2);
  const shoulderY = p.belly.y + G.arm.shoulderY; // belly lean is tiny here; close enough for this check
  for (const arm of [p.armN, p.armF]) assert.ok(limbEnd(arm, G.arm.hh).y < shoulderY - 6);
  assert.ok(Math.abs(p.belly.y - (GROUND - G.feetY - 3)) < 1e-9);
});

test('the dance starts with feet on the ground', () => {
  const p = D.victory(100, GROUND, 1, 0);
  assert.ok(Math.abs(p.belly.y - (GROUND - G.feetY)) < 1e-9);
});

test('the dance loops every 1.6 seconds', () => {
  const a = D.victory(100, GROUND, -1, 0.37);
  const b = D.victory(100, GROUND, -1, 1.97);
  for (const k of Object.keys(a)) {
    for (const f of ['x', 'y', 'a']) assert.ok(Math.abs(a[k][f] - b[k][f]) < 1e-6, `${k}.${f}`);
  }
});
