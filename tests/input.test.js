'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sumo = require('./load.js');

function key(type, code, repeat = false) {
  return Object.assign(new Event(type, { cancelable: true }), { code, repeat });
}

function setup() {
  const win = new EventTarget();
  const canvas = new EventTarget();
  canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 480, height: 270 });
  return { win, canvas, input: Sumo.input.create(win, canvas) };
}

test('W is player 1 and the up arrow is player 2, in press order', () => {
  const { win, input } = setup();
  win.dispatchEvent(key('keydown', 'ArrowUp'));
  win.dispatchEvent(key('keydown', 'KeyW'));
  assert.deepEqual(input.takePresses(), [2, 1]);
});

test('holding a key gives one press, key-repeat is ignored', () => {
  const { win, input } = setup();
  win.dispatchEvent(key('keydown', 'KeyW'));
  win.dispatchEvent(key('keydown', 'KeyW', true));
  win.dispatchEvent(key('keydown', 'KeyW', true));
  assert.deepEqual(input.takePresses(), [1]);
});

test('a key must be released before it counts again', () => {
  const { win, input } = setup();
  win.dispatchEvent(key('keydown', 'KeyW'));
  win.dispatchEvent(key('keydown', 'KeyW'));
  win.dispatchEvent(key('keyup', 'KeyW'));
  win.dispatchEvent(key('keydown', 'KeyW'));
  assert.deepEqual(input.takePresses(), [1, 1]);
});

test('takePresses empties the queue', () => {
  const { win, input } = setup();
  win.dispatchEvent(key('keydown', 'KeyW'));
  input.takePresses();
  assert.deepEqual(input.takePresses(), []);
});

test('game keys are prevented (no page scrolling), other keys are left alone', () => {
  const { win, input } = setup();
  const up = key('keydown', 'ArrowUp');
  const other = key('keydown', 'KeyQ');
  win.dispatchEvent(up);
  win.dispatchEvent(other);
  assert.equal(up.defaultPrevented, true);
  assert.equal(other.defaultPrevented, false);
  assert.deepEqual(input.takePresses(), [2]);
});

test('losing window focus releases held keys', () => {
  const { win, input } = setup();
  win.dispatchEvent(key('keydown', 'KeyW'));
  win.dispatchEvent(new Event('blur'));
  win.dispatchEvent(key('keydown', 'KeyW'));
  assert.deepEqual(input.takePresses(), [1, 1]);
});

test('clicks arrive in game pixel coordinates', () => {
  const { canvas, input } = setup();
  canvas.dispatchEvent(Object.assign(new Event('pointerdown'), { clientX: 250, clientY: 155 }));
  assert.deepEqual(input.takeClicks(), [{ x: 120, y: 67.5 }]);
  assert.deepEqual(input.takeClicks(), []);
});

test('inside checks a point against a button box', () => {
  const box = { x: 10, y: 10, w: 20, h: 5 };
  assert.equal(Sumo.input.inside({ x: 10, y: 10 }, box), true);
  assert.equal(Sumo.input.inside({ x: 30, y: 12 }, box), false);
  assert.equal(Sumo.input.inside({ x: 20, y: 15 }, box), false);
});

test('dispose removes the listeners', () => {
  const { win, input } = setup();
  input.dispose();
  win.dispatchEvent(key('keydown', 'KeyW'));
  assert.deepEqual(input.takePresses(), []);
});
