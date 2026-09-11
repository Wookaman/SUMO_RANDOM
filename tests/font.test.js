'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sumo = require('./load.js');

const { font, pixels } = Sumo;
const INK = '#000000';

function inkCount(buf) {
  return buf.px.filter((c) => c === INK).length;
}

test('text width is 3 pixels per glyph plus 1 pixel gaps, times scale', () => {
  assert.equal(font.textWidth('0 - 0', 2), 38);
  assert.equal(font.textWidth('A', 1), 3);
  assert.equal(font.textWidth('', 3), 0);
});

test('a glyph fills exactly its lit cells', () => {
  const buf = pixels.makeBuf(20, 10);
  font.drawText(buf, '1', 10, 0, 1, INK);
  const lit = [...font.GLYPHS['1']].filter((b) => b === '1').length;
  assert.equal(inkCount(buf), lit);
});

test('scale 2 fills four pixels per lit cell', () => {
  const buf = pixels.makeBuf(20, 12);
  font.drawText(buf, '1', 10, 0, 2, INK);
  const lit = [...font.GLYPHS['1']].filter((b) => b === '1').length;
  assert.equal(inkCount(buf), lit * 4);
});

test('text is centred on cx', () => {
  const buf = pixels.makeBuf(20, 6);
  font.drawText(buf, 'I', 10, 0, 1, INK); // top row of I is 111
  assert.equal(pixels.get(buf, 8, 0), null);
  assert.equal(pixels.get(buf, 9, 0), INK);
  assert.equal(pixels.get(buf, 11, 0), INK);
  assert.equal(pixels.get(buf, 12, 0), null);
});

test('unknown characters throw so typos are caught early', () => {
  const buf = pixels.makeBuf(20, 6);
  assert.throws(() => font.drawText(buf, 'a', 10, 0, 1, INK), /No glyph for "a"/);
});

test('every text the game shows can be drawn', () => {
  const buf = pixels.makeBuf(240, 20);
  for (const text of ['SUMO RANDOM', 'START', 'REMATCH', 'READY', 'P1 [W]', 'P2 [^]', 'GO!', 'RED +1', 'BLUE +1', 'REPLAY', '0123456789 - ']) {
    assert.doesNotThrow(() => font.drawText(buf, text, 120, 0, 1, INK), text);
  }
});
