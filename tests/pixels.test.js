'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sumo = require('./load.js');

const P = Sumo.pixels;
const { line } = Sumo.CONFIG.COLORS;
const INK = '#000000';

function count(buf, color) {
  return buf.px.filter((c) => c === color).length;
}

test('circle of radius 2 covers exactly the 12 pixels whose centres are inside it', () => {
  const buf = P.makeBuf(10, 10);
  assert.equal(P.rasterize(P.circle(5, 5, 2), buf).length, 12);
});

test('rasterize clips shapes that hang off the buffer', () => {
  const buf = P.makeBuf(4, 4);
  const idx = P.rasterize(P.circle(0, 0, 3), buf);
  assert.ok(idx.length > 0);
  assert.ok(idx.every((i) => i >= 0 && i < 16));
});

test('an ellipse turned 90 degrees matches the ellipse with swapped radii', () => {
  const buf = P.makeBuf(20, 20);
  const a = P.rasterize(P.ellipse(10, 10, 6, 3, Math.PI / 2), buf).sort((x, y) => x - y);
  const b = P.rasterize(P.ellipse(10, 10, 3, 6, 0), buf).sort((x, y) => x - y);
  assert.deepEqual(a, b);
});

test('capsule covers both end points', () => {
  const buf = P.makeBuf(20, 20);
  P.paint(buf, P.capsule({ x: 3.5, y: 3.5 }, { x: 15.5, y: 12.5 }, 1.5), INK);
  assert.equal(P.get(buf, 3, 3), INK);
  assert.equal(P.get(buf, 15, 12), INK);
});

test('clip keeps only the part of a shape the predicate allows', () => {
  const buf = P.makeBuf(10, 10);
  const top = P.clip(P.rect(0, 0, 10, 10), (x, y) => y < 5);
  assert.equal(P.rasterize(top, buf).length, 50);
});

test("'ext' outline draws a 1px grey ring around the fill", () => {
  const buf = P.makeBuf(8, 8);
  P.paint(buf, P.rect(2, 2, 4, 4), INK, 'ext', 1);
  assert.equal(count(buf, INK), 4);
  assert.equal(count(buf, line), 12);
});

test("'ext' outline never paints over the same owner's fill", () => {
  const buf = P.makeBuf(8, 8);
  P.paint(buf, P.rect(1, 1, 3, 3), INK, 'ext', 1);
  P.paint(buf, P.rect(3, 1, 5, 3), INK, 'ext', 1);
  assert.equal(P.get(buf, 2, 1), INK);
  assert.equal(P.get(buf, 2, 2), INK);
});

test("'full' outline does paint over the same owner's fill, separating parts", () => {
  const buf = P.makeBuf(8, 8);
  P.paint(buf, P.rect(0, 0, 8, 8), INK, 'none', 1);
  P.paint(buf, P.rect(3, 3, 5, 5), INK, 'full', 1);
  assert.equal(P.get(buf, 2, 2), line);
  assert.equal(P.get(buf, 3, 3), INK);
});

test("'none' outline only fills", () => {
  const buf = P.makeBuf(8, 8);
  P.paint(buf, P.rect(2, 2, 4, 4), INK);
  assert.equal(count(buf, line), 0);
});

test('toRGBA decodes colours and uses the background for empty pixels', () => {
  const buf = P.makeBuf(2, 1);
  P.paint(buf, P.rect(0, 0, 1, 1), '#d42a2a');
  const rgba = P.toRGBA(buf, '#ffffff');
  assert.deepEqual([...rgba], [212, 42, 42, 255, 255, 255, 255, 255]);
});

test('flush copies the buffer into a canvas context', () => {
  const buf = P.makeBuf(1, 1);
  let put = null;
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (img, x, y) => { put = { img, x, y }; },
  };
  P.flush(buf, ctx, '#000000');
  assert.deepEqual([...put.img.data], [0, 0, 0, 255]);
  assert.equal(put.x, 0);
});
