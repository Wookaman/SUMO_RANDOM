# Sumo Random Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Sumo Random, a local two-player, one-key-each ragdoll sumo game that runs in a browser by double-clicking `index.html`.

**Architecture:** Plain JavaScript classic scripts that all hang off one `globalThis.Sumo` namespace, with Planck.js (a JavaScript port of Box2D) for ragdoll physics. Game rules, the match state machine, pixel drawing, input and poses are pure modules tested in Node; physics modules are tested in Node against the same vendored Planck file; the browser-only loop in `src/game.js` just wires them together. Everything is drawn into a 240x135 pixel buffer that is scaled up with hard pixel edges.

**Tech Stack:** HTML5 canvas, JavaScript (no framework, no bundler), Planck.js 1.5.0 (vendored), Node 24 built-in test runner (`node --test`).

## Global Constraints

Read `CONTEXT.md` first and use its words in code and comments (Wrestler, Ring, Floor, Ring-out Line, Start Mark, Charge, Belly Bump, Ready Check, Plop-in, Ring-out, Bout, Point, Match, Victory Dance).

- Runs by double-clicking `index.html` (file://). Therefore: classic `<script src>` tags only, no ES modules, no fetch of local files, no build step.
- Every source file is an IIFE that adds to `globalThis.Sumo`. No other globals except `planck` (from the vendored file).
- Planck.js pinned to **1.5.0**, vendored at `vendor/planck.min.js`. No other runtime dependencies. No npm dependencies at all (tests use `node:test` and `node:assert/strict`).
- Internal resolution **240x135**, scaled by a whole number to fit the window, `image-rendering: pixelated`, white page background.
- Colours: black, white and grey only, except Player 1's mawashi **red** and Player 2's mawashi **blue**. No background art. No audio.
- Physics world uses **y-down** coordinates (gravity is +y) so physics and screen agree. `PPM = 10` pixels per physics metre. All config geometry is in pixels.
- Controls: Player 1 = `KeyW`, Player 2 = `ArrowUp`. One press = one Charge. Holding and key-repeat do nothing. START and REMATCH are clicked with the mouse.
- Points to win a Match: **5**.
- All game-feel tuning numbers (sizes, physics, move strengths, timings) live in `src/config.js`. Small drawing and animation constants that only one module uses (text positions, dance wobble amounts) may stay in that module, exactly as written in this plan.
- Commit after every task. End every commit message with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Agreed Game Design (the spec)

- **Ring**: raised grey block, two thirds of the screen wide, Floor line below it. A black band on the Ring's side marks the **Ring-out Line**, one head-height below the Ring top. The Ring is taller than a standing Wrestler plus one head, so a Wrestler standing on the Floor is always fully below the line.
- **Wrestler** (approved mockup variant A, "Beach ball"): about 29px tall, side view, very fat belly drawn pushed forward, nose bump and topknot show facing, 1px grey outline, black silhouette, coloured mawashi band. Full ragdoll: belly, head, two arms, two legs, all colliding with the other Wrestler. A Wrestler's own parts never collide with each other.
- **Charge**: one press = one belly-first lunge along the Wrestler's current lean (the whole ragdoll gets a velocity kick in the direction the body is tilted, angled 25 degrees upward from "forward"). Allowed whenever any part touches the Ring or the Floor, never in mid-air. During a Charge (0.3s) the belly leads: arms swing back, head tips back, legs kick back.
- **Upright pull**: a gentle torque keeps a standing Wrestler wobbling upright. It only acts while the belly is within about 57 degrees of upright, so a fallen Wrestler must get up by timing Charges.
- **Facing**: Wrestlers always face each other. The physics skeleton is left/right symmetric, so turning around only changes drawing and Charge direction.
- **Belly**: a little extra bouncy. **Belly Bump** (belly touches belly) throws both Wrestlers apart harder than any other contact.
- **Ring-out**: a Wrestler's whole body is below the Ring-out Line. The first Wrestler to have a Ring-out loses the Bout, touched or not. Same physics step for both = replay the Bout, no Point. Falling over on the Ring is not a Ring-out. No walls: leaving the screen is allowed.
- **Flow**: Title (SUMO RANDOM + START button, mouse) -> Ready Check (Ring shown, both Wrestlers standing on their Start Marks, labels "P1 [W]" / "P2 [^]" turn into "READY" when pressed, cannot un-ready) -> Plop-in (both Wrestlers drop from above the screen onto their Start Marks, small landing squash) -> "GO!" and keys go live the moment both have landed -> Ring-out -> physics keeps running 1.5s showing "RED +1" / "BLUE +1" / "REPLAY" and the score updates -> next Plop-in. First to 5: the loser lies limp, the winner does the Victory Dance on the spot (wherever it is, even on the Floor or off-screen); after 2s a REMATCH button appears; clicking it goes to a new Ready Check with the score reset to 0 - 0.
- Score "0 - 0" in black at top centre, Player 1's score on the left, on every screen except the title.

## File Structure

| File | Responsibility |
|---|---|
| `index.html` | Canvas, page styling, script tags in load order |
| `vendor/planck.min.js` | Planck.js 1.5.0, untouched |
| `src/config.js` | Every constant: screen, colours, Wrestler geometry, Ring geometry, physics and move tuning, timings, keys, buttons |
| `src/pixels.js` | Pixel buffer, hard-edged shapes, outline painting, copy to canvas |
| `src/font.js` | 3x5 pixel font and text drawing |
| `src/input.js` | Key presses -> one Charge per press; mouse clicks -> game pixel coordinates |
| `src/rules.js` | Pure game rules and pure physics maths (Ring-out, Bout result, scoring, facing, Charge direction, upright torque, Belly Bump strength, Victory Dance spot) |
| `src/wrestler.js` | One Wrestler ragdoll in a Planck world |
| `src/arena.js` | The Planck world: Ring, Floor, both Wrestlers, Belly Bumps, Plop-in |
| `src/dance.js` | Hand-made poses: standing and the Victory Dance |
| `src/match.js` | Match state machine (title, ready, plop, fight, point, victory) and score |
| `src/render.js` | Draws a whole frame into the pixel buffer from a plain "view" object |
| `src/game.js` | Browser only: main loop, wiring, canvas scaling |
| `tests/load.js` | Loads Planck and every existing `src` file into Node, returns `Sumo` |
| `tests/*.test.js` | One test file per `src` module |

**Load order** (same in `index.html` and `tests/load.js`): `config, pixels, font, input, rules, wrestler, arena, dance, match, render` (+ `game` in the browser only).

**Shared data shape - `PartTransforms`** (pixels, angles in radians, y-down, positive angle = clockwise on screen). Produced by `Sumo.wrestler.parts`, `Sumo.dance.pose`, consumed by `Sumo.render`:

```js
{ belly: {x, y, a}, head: {x, y, a}, armN: {x, y, a}, armF: {x, y, a}, legN: {x, y, a}, legF: {x, y, a} }
```

`N` = near (drawn in front), `F` = far (drawn behind). Each `{x, y}` is the centre of that body part. Arms and legs are boxes whose long axis is their local y axis.

**Angle convention** (y-down): rotating a local vector `(u, v)` by angle `a` gives `(u*cos(a) - v*sin(a), u*sin(a) + v*cos(a))`. A limb hanging straight down rotated by a positive angle swings toward -x. So for a Wrestler with `facing` (+1 = facing right, -1 = facing left), swinging a limb **forward** by `f` radians means angle `-facing * f`.

---

## Task 1: Project scaffold, vendored Planck, config

**Files:**
- Create: `vendor/planck.min.js` (downloaded)
- Create: `package.json`
- Create: `tests/load.js`
- Create: `tests/config.test.js`
- Create: `src/config.js`
- Create: `docs/adr/0002-classic-scripts-shared-global.md`

**Interfaces:**
- Consumes: nothing
- Produces: `Sumo.CONFIG = { W, H, PPM, WRESTLER, ARENA, PHYSICS, MOVES, TIMING, RULES, COLORS, KEYS, BUTTONS }` (exact fields in Step 6). `tests/load.js` exports the loaded `Sumo` object.

- [ ] **Step 1: Download Planck.js 1.5.0 (ask the user first: file `planck.min.js`, source jsDelivr, a few hundred KB)**

```bash
mkdir -p vendor && curl -fL -o vendor/planck.min.js https://cdn.jsdelivr.net/npm/planck@1.5.0/dist/planck.min.js
node -e "const p=require('./vendor/planck.min.js'); console.log(typeof p.World, typeof p.RevoluteJoint, typeof p.Circle, typeof p.Box, typeof p.Transform.mul)"
```

Expected output: `function function function function function`

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "sumo-random",
  "private": true,
  "scripts": {
    "test": "node --test \"tests/*.test.js\""
  }
}
```

- [ ] **Step 3: Create `tests/load.js`**

```js
'use strict';
// Loads Planck and every src module that exists so far, in browser load order, and returns the shared Sumo namespace.
const fs = require('node:fs');
const path = require('node:path');

globalThis.planck = require('../vendor/planck.min.js');

const ORDER = ['config', 'pixels', 'font', 'input', 'rules', 'wrestler', 'arena', 'dance', 'match', 'render'];
for (const name of ORDER) {
  const file = path.join(__dirname, '..', 'src', `${name}.js`);
  if (fs.existsSync(file)) require(file);
}

module.exports = globalThis.Sumo;
```

- [ ] **Step 4: Write the failing test `tests/config.test.js`**

```js
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
```

- [ ] **Step 5: Run it and watch it fail**

Run: `npm test`
Expected: FAIL, `TypeError: Cannot destructure property 'W' of 'Sumo.CONFIG'` (or `Sumo` is undefined).

- [ ] **Step 6: Create `src/config.js`**

```js
(function () {
  'use strict';
  const Sumo = (globalThis.Sumo = globalThis.Sumo || {});

  const W = 240;
  const H = 135;
  const PPM = 10; // pixels per physics metre; the physics world is y-down like the screen

  // Wrestler geometry in pixels. Body space: origin = belly centre, +y down.
  // The physics skeleton is left/right symmetric; facing only changes drawing and Charge direction.
  const WRESTLER = {
    belly: { r: 9.5, drawRx: 10, drawRy: 9, drawForward: 2, band: [3, 6.5] }, // band = mawashi rows below belly centre
    head: { r: 4, y: -11, neckY: -7.5 },
    knot: { rx: 2.2, ry: 1.4, back: 2, up: 4.5 }, // topknot, relative to head centre
    nose: { r: 1.3 },
    arm: { hw: 1.7, hh: 4, shoulderY: -5 },       // box half-width / half-length
    leg: { hw: 2.2, hh: 3.6, hipX: 2.5, hipY: 5 },
    standHeight: 29,                                // topknot to feet, from the approved mockup
  };
  WRESTLER.feetY = WRESTLER.leg.hipY + 2 * WRESTLER.leg.hh; // feet bottom below belly centre when standing

  const floorY = 126;
  const headD = WRESTLER.head.r * 2;
  const ringH = WRESTLER.standHeight + headD + 3; // tall enough that a Wrestler on the Floor is fully below the Ring-out Line
  const ARENA = {
    floorY,
    ringX0: 40,
    ringX1: 200,
    ringTop: floorY - ringH,
    ringOutY: floorY - ringH + headD,
    bandH: 2,
    startX: { 1: 100, 2: 140 },
    spawnY: -20, // belly centre when a Plop-in starts, above the screen
  };

  const PHYSICS = {
    gravity: 30, // m/s^2, +y is down
    dt: 1 / 60,
    velocityIterations: 8,
    positionIterations: 3,
    density: { belly: 1.0, head: 0.6, arm: 0.5, leg: 0.8 },
    friction: { body: 0.6, leg: 1.2, ring: 0.8 },
    restitution: { body: 0.05, belly: 0.35 }, // belly a little extra bouncy
    limits: { neck: 0.5, shoulder: 2.9, hip: 0.7 },
  };

  const MOVES = {
    chargeSpeed: 14,                       // m/s added to every part along the Charge direction
    chargeElevation: (25 * Math.PI) / 180, // Charge aims this far above "forward" in body space
    chargePoseTime: 0.3,                   // seconds the Charge pose motors run
    chargeMotor: { armSpeed: 12, armTorque: 40, neckSpeed: 6, neckTorque: 20, legSpeed: 8, legTorque: 30 },
    upright: { maxAngle: 1.0, stiffness: 60, damping: 12, maxTorque: 40 },
    bellyBump: { boost: 0.8, minSpeed: 2 }, // extra separation speed = boost * approach speed (m/s), only above minSpeed
  };

  const TIMING = { linger: 1.5, go: 0.6, rematchDelay: 2, squash: 0.15 };
  const RULES = { pointsToWin: 5 };
  const COLORS = { bg: '#ffffff', ink: '#000000', line: '#9a9a9a', ring: '#9a9a9a', red: '#d42a2a', blue: '#2a4fd4' };
  const KEYS = { KeyW: 1, ArrowUp: 2 };
  const BUTTONS = {
    start: { x: 90, y: 78, w: 60, h: 17, label: 'START' },
    rematch: { x: 84, y: 22, w: 72, h: 17, label: 'REMATCH' },
  };

  Sumo.CONFIG = { W, H, PPM, WRESTLER, ARENA, PHYSICS, MOVES, TIMING, RULES, COLORS, KEYS, BUTTONS };
})();
```

- [ ] **Step 7: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS, 6 tests.

- [ ] **Step 8: Record why the code uses classic scripts, in `docs/adr/0002-classic-scripts-shared-global.md`**

```md
# Classic scripts on one shared `Sumo` global, not ES modules

The game must start by double-clicking `index.html`, and browsers refuse to load ES module scripts from file:// URLs. So every source file is a classic script (an IIFE that adds to `globalThis.Sumo`) loaded by ordered `<script src>` tags, and Node tests load the same files with `require` through `tests/load.js`. We rejected a bundler to keep the project build-free; if the game ever needs one, switching to ES modules is a mechanical change.
```

- [ ] **Step 9: Commit**

```bash
git add package.json vendor/planck.min.js src/config.js tests/load.js tests/config.test.js docs/adr/0002-classic-scripts-shared-global.md
git commit -m "feat: scaffold project, vendor Planck 1.5.0, add config

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Task 2: Pixel buffer and hard-edged shapes

**Files:**
- Create: `src/pixels.js`
- Test: `tests/pixels.test.js`

**Interfaces:**
- Consumes: `Sumo.CONFIG.COLORS.line` (outline grey)
- Produces: `Sumo.pixels`:
  - `makeBuf(w, h) -> Buf` where `Buf = { w, h, px: (string|null)[], own: Int8Array }` (`px` holds `'#rrggbb'` or `null` for background; `own` holds the owner id of each filled pixel, 0 = nobody)
  - `clear(buf)`, `get(buf, x, y) -> string|null`
  - Shapes (`Shape = { bb: [x0, y0, x1, y1], hit(x, y) -> boolean }`): `circle(cx, cy, r)`, `ellipse(cx, cy, rx, ry, angle)`, `capsule(p1, p2, r)` with `p1`/`p2` = `{x, y}`, `rect(x0, y0, x1, y1)` (x1/y1 exclusive), `clip(shape, keep(x, y) -> boolean)`
  - `rasterize(shape, buf) -> number[]` (pixel indices `y * w + x`, clipped to the buffer)
  - `paint(buf, shape, color, outline = 'none', id = 0)` where outline is `'none' | 'ext' | 'full'`
  - `toRGBA(buf, bgHex) -> Uint8ClampedArray`, `flush(buf, ctx, bgHex)`

- [ ] **Step 1: Write the failing tests `tests/pixels.test.js`**

```js
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL, `TypeError: Cannot read properties of undefined (reading 'makeBuf')`.

- [ ] **Step 3: Create `src/pixels.js`**

```js
(function () {
  'use strict';
  const Sumo = (globalThis.Sumo = globalThis.Sumo || {});

  function makeBuf(w, h) {
    return { w, h, px: new Array(w * h).fill(null), own: new Int8Array(w * h) };
  }

  function clear(buf) {
    buf.px.fill(null);
    buf.own.fill(0);
  }

  function get(buf, x, y) {
    return buf.px[y * buf.w + x];
  }

  // Shapes are hit-tested at pixel centres, so every edge is hard (no anti-aliasing).
  function circle(cx, cy, r) {
    return { bb: [cx - r, cy - r, cx + r, cy + r], hit: (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r };
  }

  function ellipse(cx, cy, rx, ry, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const R = Math.max(rx, ry);
    return {
      bb: [cx - R, cy - R, cx + R, cy + R],
      hit: (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const u = dx * c + dy * s;
        const v = -dx * s + dy * c;
        return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
      },
    };
  }

  function capsule(p1, p2, r) {
    const vx = p2.x - p1.x;
    const vy = p2.y - p1.y;
    const len2 = vx * vx + vy * vy || 1;
    return {
      bb: [Math.min(p1.x, p2.x) - r, Math.min(p1.y, p2.y) - r, Math.max(p1.x, p2.x) + r, Math.max(p1.y, p2.y) + r],
      hit: (x, y) => {
        const t = Math.max(0, Math.min(1, ((x - p1.x) * vx + (y - p1.y) * vy) / len2));
        return (x - p1.x - t * vx) ** 2 + (y - p1.y - t * vy) ** 2 <= r * r;
      },
    };
  }

  function rect(x0, y0, x1, y1) {
    return { bb: [x0, y0, x1, y1], hit: (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1 };
  }

  function clip(shape, keep) {
    return { bb: shape.bb, hit: (x, y) => shape.hit(x, y) && keep(x, y) };
  }

  function rasterize(shape, buf) {
    const [x0, y0, x1, y1] = shape.bb;
    const out = [];
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(buf.h - 1, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(buf.w - 1, Math.ceil(x1)); x++) {
        if (shape.hit(x + 0.5, y + 0.5)) out.push(y * buf.w + x);
      }
    }
    return out;
  }

  // outline: 'none' | 'ext' (only outside this owner's silhouette) | 'full' (also over this owner, to separate parts)
  function paint(buf, shape, color, outline = 'none', id = 0) {
    const lineColor = Sumo.CONFIG.COLORS.line;
    const mask = rasterize(shape, buf);
    if (outline !== 'none') {
      const inMask = new Set(mask);
      for (const i of mask) {
        const x = i % buf.w;
        const y = (i / buf.w) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= buf.w || ny >= buf.h) continue;
            const j = ny * buf.w + nx;
            if (inMask.has(j) || (outline === 'ext' && buf.own[j] === id && id !== 0)) continue;
            buf.px[j] = lineColor;
            if (buf.own[j] !== id) buf.own[j] = 0;
          }
        }
      }
    }
    for (const i of mask) {
      buf.px[i] = color;
      buf.own[i] = id;
    }
  }

  function hexToRgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }

  function toRGBA(buf, bgHex) {
    const out = new Uint8ClampedArray(buf.w * buf.h * 4);
    const cache = new Map();
    for (let i = 0; i < buf.px.length; i++) {
      const hex = buf.px[i] || bgHex;
      let rgb = cache.get(hex);
      if (!rgb) {
        rgb = hexToRgb(hex);
        cache.set(hex, rgb);
      }
      out[i * 4] = rgb[0];
      out[i * 4 + 1] = rgb[1];
      out[i * 4 + 2] = rgb[2];
      out[i * 4 + 3] = 255;
    }
    return out;
  }

  function flush(buf, ctx, bgHex) {
    const img = ctx.createImageData(buf.w, buf.h);
    img.data.set(toRGBA(buf, bgHex));
    ctx.putImageData(img, 0, 0);
  }

  Sumo.pixels = { makeBuf, clear, get, circle, ellipse, capsule, rect, clip, rasterize, paint, toRGBA, flush };
})();
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS, all config and pixels tests.

- [ ] **Step 5: Commit**

```bash
git add src/pixels.js tests/pixels.test.js
git commit -m "feat: add pixel buffer with hard-edged shapes and outlines

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Task 3: 3x5 pixel font

**Files:**
- Create: `src/font.js`
- Test: `tests/font.test.js`

**Interfaces:**
- Consumes: `Sumo.pixels.paint`, `Sumo.pixels.rect`
- Produces: `Sumo.font`:
  - `GLYPHS` - map from character to a 15-character string of `0`/`1`, 3 columns x 5 rows, read row by row from the top
  - `textWidth(text, scale) -> number` - every glyph is `3 * scale` wide with a `scale` gap between glyphs
  - `drawText(buf, text, cx, y, scale, color)` - draws `text` horizontally centred on `cx`, top edge at `y`; throws `Error('No glyph for "<ch>"')` for unknown characters. Text is upper case; `^` draws an up arrow.

- [ ] **Step 1: Write the failing tests `tests/font.test.js`**

```js
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL, `TypeError: Cannot read properties of undefined (reading 'textWidth')`.

- [ ] **Step 3: Create `src/font.js`**

```js
(function () {
  'use strict';
  const Sumo = (globalThis.Sumo = globalThis.Sumo || {});

  // 3 columns x 5 rows, read row by row from the top.
  const GLYPHS = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
    4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001010010',
    8: '111101111101111', 9: '111101111001111',
    '+': '000010111010000', '-': '000000111000000', '!': '010010010000010',
    '[': '110100100100110', ']': '011001001001011', '^': '010111010010010', ' ': '000000000000000',
  };

  function textWidth(text, scale) {
    return text.length === 0 ? 0 : text.length * 3 * scale + (text.length - 1) * scale;
  }

  function drawText(buf, text, cx, y, scale, color) {
    const { paint, rect } = Sumo.pixels;
    let x = Math.round(cx - textWidth(text, scale) / 2);
    for (const ch of text) {
      const glyph = GLYPHS[ch];
      if (!glyph) throw new Error(`No glyph for "${ch}"`);
      for (let i = 0; i < 15; i++) {
        if (glyph[i] !== '1') continue;
        const gx = x + (i % 3) * scale;
        const gy = y + Math.floor(i / 3) * scale;
        paint(buf, rect(gx, gy, gx + scale, gy + scale), color);
      }
      x += 4 * scale;
    }
  }

  Sumo.font = { GLYPHS, textWidth, drawText };
})();
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/font.js tests/font.test.js
git commit -m "feat: add 3x5 pixel font

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Task 4: Input (one press = one Charge, mouse clicks)

**Files:**
- Create: `src/input.js`
- Test: `tests/input.test.js`

**Interfaces:**
- Consumes: `Sumo.CONFIG.KEYS`, `Sumo.CONFIG.W`, `Sumo.CONFIG.H`
- Produces: `Sumo.input`:
  - `create(keyTarget, canvas) -> Input` where `keyTarget` is `window` (anything with `addEventListener`) and `canvas` also has `getBoundingClientRect()`
  - `Input.takePresses() -> (1|2)[]` - players who pressed their key since the last call, in order; empties the queue
  - `Input.takeClicks() -> {x, y}[]` - clicks in game pixel coordinates since the last call; empties the queue
  - `Input.dispose()` - removes every listener
  - `toGameCoords(clientX, clientY, rect) -> {x, y}`
  - `inside(point, box) -> boolean` where `box = {x, y, w, h}` (as in `CONFIG.BUTTONS`)

- [ ] **Step 1: Write the failing tests `tests/input.test.js`**

```js
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL, `TypeError: Cannot read properties of undefined (reading 'create')`.

- [ ] **Step 3: Create `src/input.js`**

```js
(function () {
  'use strict';
  const Sumo = (globalThis.Sumo = globalThis.Sumo || {});

  function toGameCoords(clientX, clientY, rect) {
    const { W, H } = Sumo.CONFIG;
    return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H };
  }

  function inside(point, box) {
    return point.x >= box.x && point.x < box.x + box.w && point.y >= box.y && point.y < box.y + box.h;
  }

  // One key press = one Charge: holding a key and key-repeat do nothing extra.
  function create(keyTarget, canvas) {
    const { KEYS } = Sumo.CONFIG;
    const down = new Set();
    let presses = [];
    let clicks = [];

    const onKeyDown = (e) => {
      const player = KEYS[e.code];
      if (!player) return;
      e.preventDefault(); // stops the up arrow scrolling the page
      if (e.repeat || down.has(e.code)) return;
      down.add(e.code);
      presses.push(player);
    };
    const onKeyUp = (e) => down.delete(e.code);
    const onBlur = () => down.clear();
    const onPointerDown = (e) => clicks.push(toGameCoords(e.clientX, e.clientY, canvas.getBoundingClientRect()));

    keyTarget.addEventListener('keydown', onKeyDown);
    keyTarget.addEventListener('keyup', onKeyUp);
    keyTarget.addEventListener('blur', onBlur);
    canvas.addEventListener('pointerdown', onPointerDown);

    return {
      takePresses() {
        const out = presses;
        presses = [];
        return out;
      },
      takeClicks() {
        const out = clicks;
        clicks = [];
        return out;
      },
      dispose() {
        keyTarget.removeEventListener('keydown', onKeyDown);
        keyTarget.removeEventListener('keyup', onKeyUp);
        keyTarget.removeEventListener('blur', onBlur);
        canvas.removeEventListener('pointerdown', onPointerDown);
      },
    };
  }

  Sumo.input = { create, toGameCoords, inside };
})();
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/input.js tests/input.test.js
git commit -m "feat: add one-press-one-Charge keyboard input and click coordinates

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Task 5: Pure rules and physics maths

**Files:**
- Create: `src/rules.js`
- Test: `tests/rules.test.js`

**Interfaces:**
- Consumes: nothing at load time (config objects are passed in as arguments)
- Produces: `Sumo.rules`:
  - `isRingOut(topY, ringOutY) -> boolean` - whole body below the line (y-down, so `topY > ringOutY`)
  - `resolveBout(outs) -> null | {type: 'point', winner: 1|2, loser: 1|2} | {type: 'replay'}` where `outs = {1: boolean, 2: boolean}` for one physics step
  - `addPoint(score, winner) -> score` (new object; `score = {1: number, 2: number}`)
  - `matchWinner(score, pointsToWin) -> 0|1|2`
  - `facingToward(selfX, otherX, current) -> 1|-1` (keeps `current` when closer than 0.5 px)
  - `normalizeAngle(a) -> number` in `(-PI, PI]`
  - `chargeDirection(bellyAngle, facing, elevation) -> {x, y}` unit vector
  - `uprightTorque(angle, angularVelocity, cfg) -> number` with `cfg = MOVES.upright`
  - `bellyBumpSpeed(approachSpeed, cfg) -> number` with `cfg = MOVES.bellyBump`
  - `danceSpot(bellyX, bellyY, arena) -> {x, groundY}` with `arena = CONFIG.ARENA`

- [ ] **Step 1: Write the failing tests `tests/rules.test.js`**

```js
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL, `TypeError: Cannot read properties of undefined (reading 'isRingOut')`.

- [ ] **Step 3: Create `src/rules.js`**

```js
(function () {
  'use strict';
  const Sumo = (globalThis.Sumo = globalThis.Sumo || {});

  // y is down, so "below the Ring-out Line" means a larger y.
  function isRingOut(topY, ringOutY) {
    return topY > ringOutY;
  }

  // outs: which Wrestlers had a Ring-out during one physics step.
  function resolveBout(outs) {
    if (outs[1] && outs[2]) return { type: 'replay' };
    if (outs[1]) return { type: 'point', winner: 2, loser: 1 };
    if (outs[2]) return { type: 'point', winner: 1, loser: 2 };
    return null;
  }

  function addPoint(score, winner) {
    return { ...score, [winner]: score[winner] + 1 };
  }

  function matchWinner(score, pointsToWin) {
    if (score[1] >= pointsToWin) return 1;
    if (score[2] >= pointsToWin) return 2;
    return 0;
  }

  function facingToward(selfX, otherX, current) {
    const dx = otherX - selfX;
    return Math.abs(dx) < 0.5 ? current : Math.sign(dx);
  }

  function normalizeAngle(a) {
    const TAU = 2 * Math.PI;
    let r = a % TAU;
    if (r <= -Math.PI) r += TAU;
    if (r > Math.PI) r -= TAU;
    return r;
  }

  // "Forward and a bit up" in body space, turned by the belly's current lean.
  function chargeDirection(bellyAngle, facing, elevation) {
    const lx = facing * Math.cos(elevation);
    const ly = -Math.sin(elevation);
    const c = Math.cos(bellyAngle);
    const s = Math.sin(bellyAngle);
    return { x: lx * c - ly * s, y: lx * s + ly * c };
  }

  // Gentle pull toward upright that only helps a Wrestler who is still mostly standing.
  function uprightTorque(angle, angularVelocity, cfg) {
    const a = normalizeAngle(angle);
    if (Math.abs(a) > cfg.maxAngle) return 0;
    const t = -(cfg.stiffness * a + cfg.damping * angularVelocity);
    return Math.max(-cfg.maxTorque, Math.min(cfg.maxTorque, t));
  }

  function bellyBumpSpeed(approachSpeed, cfg) {
    return approachSpeed < cfg.minSpeed ? 0 : cfg.boost * approachSpeed;
  }

  function danceSpot(bellyX, bellyY, arena) {
    const onRing = bellyY < arena.ringTop && bellyX >= arena.ringX0 && bellyX <= arena.ringX1;
    return { x: bellyX, groundY: onRing ? arena.ringTop : arena.floorY };
  }

  Sumo.rules = {
    isRingOut, resolveBout, addPoint, matchWinner, facingToward, normalizeAngle,
    chargeDirection, uprightTorque, bellyBumpSpeed, danceSpot,
  };
})();
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/rules.js tests/rules.test.js
git commit -m "feat: add pure rules for Ring-out, scoring, Charge direction and upright pull

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Task 6: Wrestler ragdoll

**Files:**
- Create: `src/wrestler.js`
- Test: `tests/wrestler.test.js`

**Interfaces:**
- Consumes: `globalThis.planck`, `Sumo.CONFIG.{PPM, WRESTLER, PHYSICS, MOVES}`, `Sumo.rules.{chargeDirection, uprightTorque, facingToward}`
- Produces: `Sumo.wrestler`:
  - `create(world, player, x, y, facing) -> Wrestler` (`x`, `y` = belly centre in pixels) where `Wrestler = { player, facing, bodies: {belly, head, armN, armF, legN, legF}, joints: {neck, shoulderN, shoulderF, hipN, hipF}, poseTimer }`
  - `parts(w) -> PartTransforms` (pixels)
  - `bellyPos(w) -> {x, y}` (pixels)
  - `topY(w) -> number` - highest point of any body part, in pixels (smallest y)
  - `isGrounded(w) -> boolean` - any part touching a static body (Ring or Floor)
  - `charge(w) -> boolean` - false (and no effect) when not grounded
  - `update(w, dt, otherBellyX, upright)` - call once before every `world.step`: turns to face `otherBellyX` (pixels, or `null` to keep facing), applies the upright pull when `upright` is true, ends the Charge pose after `MOVES.chargePoseTime`
  - `destroy(world, w)`
- Every fixture's user data is `{ player, part }` where `part` is one of the `PartTransforms` keys. Every fixture has `filterGroupIndex: -player`, so a Wrestler's own parts never collide.

- [ ] **Step 1: Write the failing tests `tests/wrestler.test.js`**

```js
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL, `TypeError: Cannot read properties of undefined (reading 'create')`.

- [ ] **Step 3: Create `src/wrestler.js`**

```js
(function () {
  'use strict';
  const Sumo = (globalThis.Sumo = globalThis.Sumo || {});

  const PART_NAMES = ['belly', 'head', 'armN', 'armF', 'legN', 'legF'];

  // One ragdoll. (x, y) is the belly centre in pixels; facing is 1 (right) or -1 (left).
  // The skeleton is left/right symmetric, so turning around never needs the bodies rebuilt.
  function create(world, player, x, y, facing) {
    const { planck } = globalThis;
    const { PPM, WRESTLER: G, PHYSICS: PH } = Sumo.CONFIG;
    const m = (px) => px / PPM;
    const def = (part, extra) => ({
      filterGroupIndex: -player, // a Wrestler's own parts never collide
      userData: { player, part },
      friction: PH.friction.body,
      restitution: PH.restitution.body,
      ...extra,
    });
    const body = (px, py) => world.createBody({ type: 'dynamic', position: { x: m(px), y: m(py) } });

    const belly = body(x, y);
    belly.createFixture(new planck.Circle(m(G.belly.r)), def('belly', { density: PH.density.belly, restitution: PH.restitution.belly }));

    const head = body(x, y + G.head.y);
    head.createFixture(new planck.Circle(m(G.head.r)), def('head', { density: PH.density.head }));

    const arm = (part) => {
      const b = body(x, y + G.arm.shoulderY + G.arm.hh);
      b.createFixture(new planck.Box(m(G.arm.hw), m(G.arm.hh)), def(part, { density: PH.density.arm }));
      return b;
    };
    const leg = (part, side) => {
      const b = body(x + side * G.leg.hipX, y + G.leg.hipY + G.leg.hh);
      b.createFixture(new planck.Box(m(G.leg.hw), m(G.leg.hh)), def(part, { density: PH.density.leg, friction: PH.friction.leg }));
      return b;
    };
    const armN = arm('armN');
    const armF = arm('armF');
    const legN = leg('legN', facing);
    const legF = leg('legF', -facing);

    const hinge = (a, b, ax, ay, limit) =>
      world.createJoint(
        new planck.RevoluteJoint(
          { enableLimit: true, lowerAngle: -limit, upperAngle: limit, enableMotor: false, motorSpeed: 0, maxMotorTorque: 0 },
          a, b, { x: m(ax), y: m(ay) },
        ),
      );
    const joints = {
      neck: hinge(belly, head, x, y + G.head.neckY, PH.limits.neck),
      shoulderN: hinge(belly, armN, x, y + G.arm.shoulderY, PH.limits.shoulder),
      shoulderF: hinge(belly, armF, x, y + G.arm.shoulderY, PH.limits.shoulder),
      hipN: hinge(belly, legN, x + facing * G.leg.hipX, y + G.leg.hipY, PH.limits.hip),
      hipF: hinge(belly, legF, x - facing * G.leg.hipX, y + G.leg.hipY, PH.limits.hip),
    };

    return { player, facing, bodies: { belly, head, armN, armF, legN, legF }, joints, poseTimer: 0 };
  }

  function parts(w) {
    const { PPM } = Sumo.CONFIG;
    const out = {};
    for (const name of PART_NAMES) {
      const b = w.bodies[name];
      const p = b.getPosition();
      out[name] = { x: p.x * PPM, y: p.y * PPM, a: b.getAngle() };
    }
    return out;
  }

  function bellyPos(w) {
    const { PPM } = Sumo.CONFIG;
    const p = w.bodies.belly.getPosition();
    return { x: p.x * PPM, y: p.y * PPM };
  }

  function topY(w) {
    const { planck } = globalThis;
    let top = Infinity;
    for (const b of Object.values(w.bodies)) {
      const xf = b.getTransform();
      for (let f = b.getFixtureList(); f; f = f.getNext()) {
        const shape = f.getShape();
        if (f.getType() === 'circle') {
          const c = planck.Transform.mul(xf, shape.getCenter());
          top = Math.min(top, c.y - shape.getRadius());
        } else {
          for (let i = 0; i < shape.m_count; i++) top = Math.min(top, planck.Transform.mul(xf, shape.m_vertices[i]).y);
        }
      }
    }
    return top * Sumo.CONFIG.PPM;
  }

  function isGrounded(w) {
    for (const b of Object.values(w.bodies)) {
      for (let ce = b.getContactList(); ce; ce = ce.next) {
        if (ce.other.isStatic() && ce.contact.isTouching()) return true;
      }
    }
    return false;
  }

  function motor(joint, on, speed, torque) {
    joint.enableMotor(on);
    joint.setMotorSpeed(on ? speed : 0);
    joint.setMaxMotorTorque(on ? torque : 0);
  }

  // Belly leads: arms and legs swing back (+facing), head tips back (-facing). See the angle convention in the plan.
  function setChargePose(w, on) {
    const M = Sumo.CONFIG.MOVES.chargeMotor;
    const f = w.facing;
    motor(w.joints.shoulderN, on, f * M.armSpeed, M.armTorque);
    motor(w.joints.shoulderF, on, f * M.armSpeed, M.armTorque);
    motor(w.joints.hipN, on, f * M.legSpeed, M.legTorque);
    motor(w.joints.hipF, on, f * M.legSpeed, M.legTorque);
    motor(w.joints.neck, on, -f * M.neckSpeed, M.neckTorque);
  }

  function charge(w) {
    if (!isGrounded(w)) return false;
    const { MOVES } = Sumo.CONFIG;
    const dir = Sumo.rules.chargeDirection(w.bodies.belly.getAngle(), w.facing, MOVES.chargeElevation);
    for (const b of Object.values(w.bodies)) {
      const k = MOVES.chargeSpeed * b.getMass(); // same speed kick for every part, so the ragdoll moves as one
      b.applyLinearImpulse({ x: dir.x * k, y: dir.y * k }, b.getWorldCenter(), true);
    }
    setChargePose(w, true);
    w.poseTimer = MOVES.chargePoseTime;
    return true;
  }

  function update(w, dt, otherBellyX, upright) {
    const { MOVES } = Sumo.CONFIG;
    const belly = w.bodies.belly;
    if (otherBellyX !== null) w.facing = Sumo.rules.facingToward(bellyPos(w).x, otherBellyX, w.facing);
    if (upright) belly.applyTorque(Sumo.rules.uprightTorque(belly.getAngle(), belly.getAngularVelocity(), MOVES.upright), true);
    if (w.poseTimer > 0) {
      w.poseTimer -= dt;
      if (w.poseTimer <= 0) {
        w.poseTimer = 0;
        setChargePose(w, false);
      }
    }
  }

  function destroy(world, w) {
    for (const b of Object.values(w.bodies)) world.destroyBody(b);
  }

  Sumo.wrestler = { create, parts, bellyPos, topY, isGrounded, charge, update, destroy };
})();
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS. If only "lands and stays standing" or "arms swing back" fails, the code is right but the tuning is off: raise `MOVES.upright.stiffness` / `maxTorque` (standing) or `MOVES.chargeMotor.armTorque` (arms) in `src/config.js` in small steps until it passes. Do not weaken the tests.

- [ ] **Step 5: Commit**

```bash
git add src/wrestler.js tests/wrestler.test.js src/config.js
git commit -m "feat: add Wrestler ragdoll with Charge, upright pull and facing

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Task 7: Arena - Ring, Floor, Plop-in, Ring-outs and Belly Bumps

**Files:**
- Create: `src/arena.js`
- Test: `tests/arena.test.js`

**Interfaces:**
- Consumes: `globalThis.planck`, `Sumo.CONFIG.{PPM, ARENA, PHYSICS, MOVES}`, all of `Sumo.wrestler`, `Sumo.rules.{isRingOut, bellyBumpSpeed}`
- Produces: `Sumo.arena`:
  - `create(overrides = {}) -> Arena` where `overrides.bellyBump` replaces `MOVES.bellyBump` (tests only). `Arena = { world, wrestlers: {1: Wrestler|null, 2: Wrestler|null}, bumps: [], bellyBump, upright: {1: boolean, 2: boolean} }`
  - `spawn(arena, player, x, y, facing)` - replaces that player's Wrestler (pixels)
  - `remove(arena, player)`
  - `resetBout(arena)` - Plop-in: both Wrestlers respawn above the screen over their Start Marks, facing each other, upright pull on
  - `step(arena, dt)` - updates both Wrestlers, steps the world, then applies Belly Bumps
  - `charge(arena, player) -> boolean`
  - `isLanded(arena, player) -> boolean`, `bothLanded(arena) -> boolean`
  - `ringOuts(arena) -> {1: boolean, 2: boolean}`
  - `parts(arena, player) -> PartTransforms|null`, `facing(arena, player) -> 1|-1`, `bellyPos(arena, player) -> {x, y}|null`
  - `setUpright(arena, player, on)` - turn the upright pull off to leave the loser limp

- [ ] **Step 1: Write the failing tests `tests/arena.test.js`**

```js
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL, `TypeError: Cannot read properties of undefined (reading 'create')`.

- [ ] **Step 3: Create `src/arena.js`**

```js
(function () {
  'use strict';
  const Sumo = (globalThis.Sumo = globalThis.Sumo || {});

  function create(overrides = {}) {
    const { planck } = globalThis;
    const { PPM, ARENA: A, PHYSICS: PH, MOVES } = Sumo.CONFIG;
    const m = (px) => px / PPM;
    const world = new planck.World({ gravity: { x: 0, y: PH.gravity } });

    const staticBox = (x0, y0, x1, y1) => {
      const b = world.createBody({ type: 'static', position: { x: m((x0 + x1) / 2), y: m((y0 + y1) / 2) } });
      b.createFixture(new planck.Box(m((x1 - x0) / 2), m((y1 - y0) / 2)), { friction: PH.friction.ring });
      return b;
    };
    staticBox(A.ringX0, A.ringTop, A.ringX1, A.floorY); // Ring
    staticBox(-2000, A.floorY, 2240, A.floorY + 20); // Floor, wide enough that nobody falls forever off-screen

    const arena = {
      world,
      wrestlers: { 1: null, 2: null },
      bumps: [],
      bellyBump: overrides.bellyBump || MOVES.bellyBump,
      upright: { 1: true, 2: true },
    };

    world.on('begin-contact', (contact) => {
      const fa = contact.getFixtureA();
      const fb = contact.getFixtureB();
      const a = fa.getUserData();
      const b = fb.getUserData();
      if (!a || !b || a.part !== 'belly' || b.part !== 'belly' || a.player === b.player) return;
      // Only measure here: Planck forbids changing the world inside a callback, so the push happens after the step.
      arena.bumps.push(measureBump(fa.getBody(), fb.getBody(), a.player, b.player));
    });

    return arena;
  }

  function measureBump(bodyA, bodyB, playerA, playerB) {
    const ca = bodyA.getPosition();
    const cb = bodyB.getPosition();
    const len = Math.hypot(cb.x - ca.x, cb.y - ca.y) || 1;
    const nx = (cb.x - ca.x) / len;
    const ny = (cb.y - ca.y) / len;
    const va = bodyA.getLinearVelocity();
    const vb = bodyB.getLinearVelocity();
    const approach = (va.x - vb.x) * nx + (va.y - vb.y) * ny;
    return { from: playerA, to: playerB, nx, ny, approach };
  }

  function kick(w, vx, vy) {
    if (!w) return;
    for (const b of Object.values(w.bodies)) {
      const mass = b.getMass();
      b.applyLinearImpulse({ x: vx * mass, y: vy * mass }, b.getWorldCenter(), true);
    }
  }

  function applyBumps(arena) {
    for (const bump of arena.bumps) {
      const half = Sumo.rules.bellyBumpSpeed(bump.approach, arena.bellyBump) / 2;
      if (half === 0) continue;
      kick(arena.wrestlers[bump.from], -bump.nx * half, -bump.ny * half);
      kick(arena.wrestlers[bump.to], bump.nx * half, bump.ny * half);
    }
    arena.bumps.length = 0;
  }

  function remove(arena, player) {
    const w = arena.wrestlers[player];
    if (!w) return;
    Sumo.wrestler.destroy(arena.world, w);
    arena.wrestlers[player] = null;
  }

  function spawn(arena, player, x, y, facing) {
    remove(arena, player);
    arena.wrestlers[player] = Sumo.wrestler.create(arena.world, player, x, y, facing);
  }

  function resetBout(arena) {
    const { ARENA } = Sumo.CONFIG;
    spawn(arena, 1, ARENA.startX[1], ARENA.spawnY, 1);
    spawn(arena, 2, ARENA.startX[2], ARENA.spawnY, -1);
    arena.bumps.length = 0;
    arena.upright = { 1: true, 2: true };
  }

  function bellyPos(arena, player) {
    const w = arena.wrestlers[player];
    return w ? Sumo.wrestler.bellyPos(w) : null;
  }

  function step(arena, dt) {
    const { PHYSICS } = Sumo.CONFIG;
    const other = (p) => (bellyPos(arena, p) ? bellyPos(arena, p).x : null);
    if (arena.wrestlers[1]) Sumo.wrestler.update(arena.wrestlers[1], dt, other(2), arena.upright[1]);
    if (arena.wrestlers[2]) Sumo.wrestler.update(arena.wrestlers[2], dt, other(1), arena.upright[2]);
    arena.world.step(dt, PHYSICS.velocityIterations, PHYSICS.positionIterations);
    applyBumps(arena);
  }

  function charge(arena, player) {
    const w = arena.wrestlers[player];
    return w ? Sumo.wrestler.charge(w) : false;
  }

  function isLanded(arena, player) {
    const w = arena.wrestlers[player];
    return !!w && Sumo.wrestler.isGrounded(w);
  }

  function bothLanded(arena) {
    return isLanded(arena, 1) && isLanded(arena, 2);
  }

  function ringOuts(arena) {
    const { ringOutY } = Sumo.CONFIG.ARENA;
    const out = (w) => !!w && Sumo.rules.isRingOut(Sumo.wrestler.topY(w), ringOutY);
    return { 1: out(arena.wrestlers[1]), 2: out(arena.wrestlers[2]) };
  }

  function parts(arena, player) {
    const w = arena.wrestlers[player];
    return w ? Sumo.wrestler.parts(w) : null;
  }

  function facing(arena, player) {
    const w = arena.wrestlers[player];
    return w ? w.facing : player === 1 ? 1 : -1;
  }

  function setUpright(arena, player, on) {
    arena.upright[player] = on;
  }

  Sumo.arena = {
    create, spawn, remove, resetBout, step, charge, isLanded, bothLanded, ringOuts, parts, facing, bellyPos, setUpright,
  };
})();
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS. If the landing-time test fails, adjust `PHYSICS.gravity` or `ARENA.spawnY` (not the test's 0.5-1.2s window, which is the agreed Plop-in feel).

- [ ] **Step 5: Commit**

```bash
git add src/arena.js tests/arena.test.js src/config.js
git commit -m "feat: add arena with Ring, Floor, Plop-in, Ring-out checks and Belly Bumps

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Task 8: Hand-made poses - standing and the Victory Dance

**Files:**
- Create: `src/dance.js`
- Test: `tests/dance.test.js`

**Interfaces:**
- Consumes: `Sumo.CONFIG.WRESTLER`
- Produces: `Sumo.dance`:
  - `pose(x, groundY, facing, angles) -> PartTransforms` where `angles = {a, head, armN, armF, legN, legF, hop}`; `a` is the belly lean, the others are **forward** swings in radians relative to the belly, `hop` is pixels off the ground
  - `standing(x, groundY, facing) -> PartTransforms` - used on the Ready Check screen
  - `victory(x, groundY, facing, t) -> PartTransforms` - Victory Dance at time `t` seconds; loops every 1.6 s

- [ ] **Step 1: Write the failing tests `tests/dance.test.js`**

```js
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL, `TypeError: Cannot read properties of undefined (reading 'standing')`.

- [ ] **Step 3: Create `src/dance.js`**

```js
(function () {
  'use strict';
  const Sumo = (globalThis.Sumo = globalThis.Sumo || {});

  function rot(a, u, v) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: u * c - v * s, y: u * s + v * c };
  }

  // Hand-made PartTransforms. Limb angles are forward swings (a limb swung forward by f has angle -facing * f).
  function pose(x, groundY, facing, angles) {
    const G = Sumo.CONFIG.WRESTLER;
    const swing = (forward) => -facing * forward;
    const a = angles.a;
    const belly = { x, y: groundY - G.feetY - angles.hop, a };
    const at = (u, v) => {
      const p = rot(a, u, v);
      return { x: belly.x + p.x, y: belly.y + p.y };
    };
    const limb = (joint, angle, hh) => {
      const d = rot(angle, 0, hh);
      return { x: joint.x + d.x, y: joint.y + d.y, a: angle };
    };

    const neck = at(0, G.head.neckY);
    const headA = a + swing(angles.head);
    const headOffset = rot(headA, 0, G.head.y - G.head.neckY);
    const shoulder = at(0, G.arm.shoulderY);

    return {
      belly,
      head: { x: neck.x + headOffset.x, y: neck.y + headOffset.y, a: headA },
      armN: limb(shoulder, a + swing(angles.armN), G.arm.hh),
      armF: limb(shoulder, a + swing(angles.armF), G.arm.hh),
      legN: limb(at(facing * G.leg.hipX, G.leg.hipY), a + swing(angles.legN), G.leg.hh),
      legF: limb(at(-facing * G.leg.hipX, G.leg.hipY), a + swing(angles.legF), G.leg.hh),
    };
  }

  const STANDING = { a: 0, head: 0, armN: 0.25, armF: -0.2, legN: 0.12, legF: -0.12, hop: 0 };

  function standing(x, groundY, facing) {
    return pose(x, groundY, facing, STANDING);
  }

  // Both arms pump in the air, a little hop on every beat, a slow sway. Loops every 1.6 s.
  function victory(x, groundY, facing, t) {
    const beat = 0.4;
    const ph = (Math.PI * t) / beat;
    const up = Math.PI - 0.5; // arm pointing up and a little forward
    const pump = 0.35 * Math.sin(ph);
    return pose(x, groundY, facing, {
      a: 0.12 * Math.sin(ph / 2),
      head: 0.15 * Math.sin(ph),
      armN: up + pump,
      armF: -(up + pump),
      legN: 0.25 * Math.sin(ph),
      legF: -0.25 * Math.sin(ph),
      hop: 3 * Math.abs(Math.sin(ph)),
    });
  }

  Sumo.dance = { pose, standing, victory };
})();
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dance.js tests/dance.test.js
git commit -m "feat: add standing pose and Victory Dance

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Task 9: Match state machine

**Files:**
- Create: `src/match.js`
- Test: `tests/match.test.js`

**Interfaces:**
- Consumes: `Sumo.CONFIG.{TIMING, RULES}`, `Sumo.rules.{addPoint, matchWinner}`
- Produces: `Sumo.match` (pure, no physics; `game.js` watches `m.state` changes to drive the arena):
  - `create() -> Match` where `Match = { state: 'title'|'ready'|'plop'|'fight'|'point'|'victory', score: {1, 2}, ready: {1: boolean, 2: boolean}, timer, goTimer, lastBout: null|resolveBout result, winner: 0|1|2, rematchVisible: boolean }`
  - `clickStart(m) -> boolean` - START on the title, or REMATCH once visible; both go to a fresh Ready Check with the score at 0 - 0
  - `press(m, player) -> 'ready'|'charge'|null` - what a key press means right now
  - `landed(m)` - both Wrestlers landed after a Plop-in: start the fight and show "GO!"
  - `boutResult(m, result)` - feed `Sumo.rules.resolveBout` output (ignored unless fighting or when `result` is null)
  - `tick(m, dt)`
  - `overlayText(m) -> 'GO!'|'RED +1'|'BLUE +1'|'REPLAY'|null`

- [ ] **Step 1: Write the failing tests `tests/match.test.js`**

```js
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL, `TypeError: Cannot read properties of undefined (reading 'create')`.

- [ ] **Step 3: Create `src/match.js`**

```js
(function () {
  'use strict';
  const Sumo = (globalThis.Sumo = globalThis.Sumo || {});

  function create() {
    return {
      state: 'title',
      score: { 1: 0, 2: 0 },
      ready: { 1: false, 2: false },
      timer: 0,
      goTimer: 0,
      lastBout: null,
      winner: 0,
      rematchVisible: false,
    };
  }

  // START (title) and REMATCH (after the Victory Dance) both lead to a fresh Ready Check at 0 - 0.
  function clickStart(m) {
    const canStart = m.state === 'title' || (m.state === 'victory' && m.rematchVisible);
    if (!canStart) return false;
    Object.assign(m, create(), { state: 'ready' });
    return true;
  }

  function press(m, player) {
    if (m.state === 'ready') {
      if (m.ready[player]) return null;
      m.ready[player] = true;
      if (m.ready[1] && m.ready[2]) m.state = 'plop';
      return 'ready';
    }
    return m.state === 'fight' ? 'charge' : null;
  }

  function landed(m) {
    if (m.state !== 'plop') return;
    m.state = 'fight';
    m.goTimer = Sumo.CONFIG.TIMING.go;
  }

  function boutResult(m, result) {
    if (m.state !== 'fight' || !result) return;
    m.lastBout = result;
    if (result.type === 'point') m.score = Sumo.rules.addPoint(m.score, result.winner);
    m.state = 'point';
    m.timer = 0;
    m.goTimer = 0;
  }

  function tick(m, dt) {
    const { TIMING, RULES } = Sumo.CONFIG;
    m.goTimer = Math.max(0, m.goTimer - dt);
    if (m.state === 'point') {
      m.timer += dt;
      if (m.timer >= TIMING.linger - 1e-9) {
        const winner = Sumo.rules.matchWinner(m.score, RULES.pointsToWin);
        if (winner) {
          m.state = 'victory';
          m.winner = winner;
          m.timer = 0;
        } else {
          m.state = 'plop';
        }
      }
    } else if (m.state === 'victory') {
      m.timer += dt;
      if (m.timer >= TIMING.rematchDelay - 1e-9) m.rematchVisible = true;
    }
  }

  function overlayText(m) {
    if (m.state === 'fight' && m.goTimer > 0) return 'GO!';
    if (m.state === 'point' && m.lastBout) {
      if (m.lastBout.type === 'replay') return 'REPLAY';
      return m.lastBout.winner === 1 ? 'RED +1' : 'BLUE +1';
    }
    return null;
  }

  Sumo.match = { create, clickStart, press, landed, boutResult, tick, overlayText };
})();
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/match.js tests/match.test.js
git commit -m "feat: add Match state machine (Ready Check, Plop-in, Bouts, Victory, Rematch)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Task 10: Renderer

**Files:**
- Create: `src/render.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: `Sumo.pixels`, `Sumo.font`, `Sumo.CONFIG.{W, WRESTLER, ARENA, COLORS, BUTTONS}`; tests also use `Sumo.dance.standing`
- Produces: `Sumo.render`:
  - `frame(buf, view)` - clears `buf` and draws a whole frame. `view = { state, score: {1, 2}, ready: {1, 2}, wrestlers: [{player, parts: PartTransforms, facing, squash}], overlay: string|null, showRematch: boolean }`. The title screen (`state === 'title'`) draws only "SUMO RANDOM" and the START button.
  - `drawWrestler(buf, parts, facing, player, squash)` - `squash` is 0-2 pixels of landing squash

- [ ] **Step 1: Write the failing tests `tests/render.test.js`**

```js
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npm test`
Expected: FAIL, `TypeError: Cannot read properties of undefined (reading 'frame')`.

- [ ] **Step 3: Create `src/render.js`**

```js
(function () {
  'use strict';
  const Sumo = (globalThis.Sumo = globalThis.Sumo || {});

  function rot(a, u, v) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { x: u * c - v * s, y: u * s + v * c };
  }

  // Draw order and outline styles come from the approved mockup: far limbs behind, near arm in front with a full outline.
  function drawWrestler(buf, parts, facing, player, squash) {
    const P = Sumo.pixels;
    const { WRESTLER: G, COLORS } = Sumo.CONFIG;
    const ink = COLORS.ink;
    const limb = (part, hw, hh) => {
      const d = rot(part.a, 0, hh - hw);
      return P.capsule({ x: part.x - d.x, y: part.y - d.y }, { x: part.x + d.x, y: part.y + d.y }, hw);
    };

    const b = parts.belly;
    const off = rot(b.a, facing * G.belly.drawForward, squash); // belly drawn pushed forward; squash keeps its bottom down
    const belly = P.ellipse(b.x + off.x, b.y + off.y, G.belly.drawRx + squash / 2, G.belly.drawRy - squash, b.a);
    const band = P.clip(belly, (x, y) => {
      const v = -(x - b.x) * Math.sin(b.a) + (y - b.y) * Math.cos(b.a); // row below the belly centre, in body space
      return v >= G.belly.band[0] && v <= G.belly.band[1];
    });
    const h = parts.head;
    const nose = rot(h.a, facing * G.head.r * 0.95, 0.8);
    const knot = rot(h.a, -facing * G.knot.back, -G.knot.up);

    P.paint(buf, limb(parts.armF, G.arm.hw, G.arm.hh), ink, 'ext', player);
    P.paint(buf, limb(parts.legF, G.leg.hw, G.leg.hh), ink, 'ext', player);
    P.paint(buf, limb(parts.legN, G.leg.hw, G.leg.hh), ink, 'ext', player);
    P.paint(buf, belly, ink, 'ext', player);
    P.paint(buf, band, player === 1 ? COLORS.red : COLORS.blue, 'none', player);
    P.paint(buf, P.circle(h.x, h.y, G.head.r), ink, 'full', player);
    P.paint(buf, P.circle(h.x + nose.x, h.y + nose.y, G.nose.r), ink, 'ext', player);
    P.paint(buf, P.ellipse(h.x + knot.x, h.y + knot.y, G.knot.rx, G.knot.ry, h.a), ink, 'ext', player);
    P.paint(buf, limb(parts.armN, G.arm.hw, G.arm.hh), ink, 'full', player);
  }

  function drawArena(buf) {
    const P = Sumo.pixels;
    const { W, ARENA: A, COLORS } = Sumo.CONFIG;
    P.paint(buf, P.rect(0, A.floorY, W, A.floorY + 1), COLORS.ink); // Floor
    P.paint(buf, P.rect(A.ringX0, A.ringTop, A.ringX1, A.floorY), COLORS.ring); // Ring
    P.paint(buf, P.rect(A.ringX0, A.ringTop, A.ringX0 + 1, A.floorY), COLORS.ink);
    P.paint(buf, P.rect(A.ringX1 - 1, A.ringTop, A.ringX1, A.floorY), COLORS.ink);
    P.paint(buf, P.rect(A.ringX0, A.ringOutY, A.ringX1, A.ringOutY + A.bandH), COLORS.ink); // Ring-out Line band
  }

  function drawButton(buf, box) {
    const { COLORS } = Sumo.CONFIG;
    Sumo.pixels.paint(buf, Sumo.pixels.rect(box.x, box.y, box.x + box.w, box.y + box.h), COLORS.ink, 'ext', 0);
    Sumo.font.drawText(buf, box.label, box.x + box.w / 2, box.y + Math.round((box.h - 10) / 2), 2, COLORS.bg);
  }

  function frame(buf, view) {
    const P = Sumo.pixels;
    const { font } = Sumo;
    const { W, ARENA: A, COLORS, BUTTONS } = Sumo.CONFIG;
    P.clear(buf);

    if (view.state === 'title') {
      font.drawText(buf, 'SUMO RANDOM', W / 2, 40, 3, COLORS.ink);
      drawButton(buf, BUTTONS.start);
      return;
    }

    drawArena(buf);
    for (const w of view.wrestlers) drawWrestler(buf, w.parts, w.facing, w.player, w.squash || 0);
    P.paint(buf, P.rect(A.ringX0, A.ringTop, A.ringX1, A.ringTop + 1), COLORS.ink); // Ring top edge, last so it sits under the feet

    font.drawText(buf, `${view.score[1]} - ${view.score[2]}`, W / 2, 4, 2, COLORS.ink);
    if (view.state === 'ready') {
      for (const p of [1, 2]) {
        const label = view.ready[p] ? 'READY' : p === 1 ? 'P1 [W]' : 'P2 [^]';
        font.drawText(buf, label, A.startX[p], A.ringTop - 44, 1, COLORS.ink);
      }
    }
    if (view.overlay) font.drawText(buf, view.overlay, W / 2, 30, 2, COLORS.ink);
    if (view.showRematch) drawButton(buf, BUTTONS.rematch);
  }

  Sumo.render = { frame, drawWrestler };
})();
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render.js tests/render.test.js
git commit -m "feat: add renderer for title, Ring, Wrestlers, score and overlays

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

## Task 11: Game loop and page

**Files:**
- Create: `src/game.js`
- Create: `index.html`

**Interfaces:**
- Consumes: everything above - `Sumo.pixels.{makeBuf, flush}`, `Sumo.input.{create, inside}`, `Sumo.arena.*`, `Sumo.match.*`, `Sumo.rules.{resolveBout, danceSpot}`, `Sumo.dance.{standing, victory}`, `Sumo.render.frame`, `Sumo.CONFIG.{W, H, ARENA, PHYSICS, TIMING, COLORS, BUTTONS}`
- Produces: the playable game. Browser only, so it is checked by playing, not by unit tests.

- [ ] **Step 1: Create `src/game.js`**

```js
(function () {
  'use strict';
  const Sumo = globalThis.Sumo;
  const { W, H, ARENA, PHYSICS, TIMING, COLORS, BUTTONS } = Sumo.CONFIG;

  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const buf = Sumo.pixels.makeBuf(W, H);
  const input = Sumo.input.create(window, canvas);
  const arena = Sumo.arena.create();
  const match = Sumo.match.create();

  let lastState = null;
  let dance = null; // { player, facing, x, groundY } while the Victory Dance plays
  const squash = { 1: 0, 2: 0 };
  const wasLanded = { 1: false, 2: false };

  // Physics follows the Match: game.js reacts whenever match.state changes.
  function onEnter(state) {
    if (state === 'ready') {
      Sumo.arena.remove(arena, 1);
      Sumo.arena.remove(arena, 2);
      dance = null;
    }
    if (state === 'plop') {
      Sumo.arena.resetBout(arena);
      wasLanded[1] = false;
      wasLanded[2] = false;
    }
    if (state === 'victory') {
      const winner = match.winner;
      const pos = Sumo.arena.bellyPos(arena, winner);
      dance = { player: winner, facing: Sumo.arena.facing(arena, winner), ...Sumo.rules.danceSpot(pos.x, pos.y, ARENA) };
      Sumo.arena.remove(arena, winner); // the winner stops being a ragdoll and dances on the spot
      Sumo.arena.setUpright(arena, 3 - winner, false); // the loser lies limp
    }
  }

  function handleInput() {
    for (const player of input.takePresses()) {
      if (Sumo.match.press(match, player) === 'charge') Sumo.arena.charge(arena, player);
    }
    for (const click of input.takeClicks()) {
      const box = match.state === 'title' ? BUTTONS.start : match.rematchVisible ? BUTTONS.rematch : null;
      if (box && Sumo.input.inside(click, box)) Sumo.match.clickStart(match);
    }
  }

  function step(dt) {
    handleInput();
    if (['plop', 'fight', 'point', 'victory'].includes(match.state)) Sumo.arena.step(arena, dt);
    for (const p of [1, 2]) {
      const landed = Sumo.arena.isLanded(arena, p);
      if (match.state === 'plop' && landed && !wasLanded[p]) squash[p] = TIMING.squash;
      wasLanded[p] = wasLanded[p] || landed;
      squash[p] = Math.max(0, squash[p] - dt);
    }
    if (match.state === 'plop' && Sumo.arena.bothLanded(arena)) Sumo.match.landed(match);
    if (match.state === 'fight') Sumo.match.boutResult(match, Sumo.rules.resolveBout(Sumo.arena.ringOuts(arena)));
    Sumo.match.tick(match, dt);
    if (match.state !== lastState) {
      lastState = match.state;
      onEnter(match.state);
    }
  }

  function view() {
    const wrestlers = [];
    if (match.state === 'ready') {
      for (const p of [1, 2]) {
        const facing = p === 1 ? 1 : -1;
        wrestlers.push({ player: p, facing, squash: 0, parts: Sumo.dance.standing(ARENA.startX[p], ARENA.ringTop, facing) });
      }
    } else {
      for (const p of [1, 2]) {
        const parts = Sumo.arena.parts(arena, p);
        if (parts) wrestlers.push({ player: p, facing: Sumo.arena.facing(arena, p), squash: squash[p] > 0 ? 2 : 0, parts });
      }
      if (dance) {
        wrestlers.push({ player: dance.player, facing: dance.facing, squash: 0, parts: Sumo.dance.victory(dance.x, dance.groundY, dance.facing, match.timer) });
      }
    }
    return {
      state: match.state,
      score: match.score,
      ready: match.ready,
      wrestlers,
      overlay: Sumo.match.overlayText(match),
      showRematch: match.state === 'victory' && match.rematchVisible,
    };
  }

  function fit() {
    const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
    canvas.style.width = `${W * s}px`;
    canvas.style.height = `${H * s}px`;
  }
  addEventListener('resize', fit);
  fit();

  let acc = 0;
  let last = performance.now();
  function loop(now) {
    acc += Math.min(0.25, (now - last) / 1000); // after a stall, catch up at most a quarter second
    last = now;
    while (acc >= PHYSICS.dt) {
      step(PHYSICS.dt);
      acc -= PHYSICS.dt;
    }
    Sumo.render.frame(buf, view());
    Sumo.pixels.flush(buf, ctx, COLORS.bg);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
```

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sumo Random</title>
<style>
  html, body { margin: 0; height: 100%; background: #ffffff; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; }
  canvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; cursor: pointer; }
</style>
</head>
<body>
<canvas id="screen" width="240" height="135"></canvas>
<script src="vendor/planck.min.js"></script>
<script src="src/config.js"></script>
<script src="src/pixels.js"></script>
<script src="src/font.js"></script>
<script src="src/input.js"></script>
<script src="src/rules.js"></script>
<script src="src/wrestler.js"></script>
<script src="src/arena.js"></script>
<script src="src/dance.js"></script>
<script src="src/match.js"></script>
<script src="src/render.js"></script>
<script src="src/game.js"></script>
</body>
</html>
```

- [ ] **Step 3: Run the unit tests**

Run: `npm test`
Expected: PASS (every test from Tasks 1-10).

- [ ] **Step 4: Play it in a browser and check each line**

Open `http://localhost:8765/` with the `static` preview from `.claude/launch.json` (agents: `preview_start` with name `static`, then screenshots, `read_console_messages`, and the `key` action for `w` / `ArrowUp`). A human can also double-click `index.html`.

- No console errors on load.
- Title: "SUMO RANDOM" and a START button on white.
- Click START: Ring with its black band, both Wrestlers standing on their Start Marks, "P1 [W]" and "P2 [^]", score "0 - 0".
- Press W: Player 1's label says READY; pressing W again changes nothing. Press Up: both Wrestlers drop from above the screen, squash on landing, "GO!" appears.
- Press W: the red Wrestler lunges belly-first at the blue one (arms and head swing back). Holding W gives one Charge. Pressing while in mid-air does nothing.
- Shove one Wrestler off the Ring: "RED +1" or "BLUE +1", the score goes up, and about 1.5s later both Plop in again.
- Score 5: the winner dances on the spot, the loser lies limp, REMATCH appears after 2s; clicking it gives a new Ready Check at "0 - 0".
- The up arrow never scrolls the page.

- [ ] **Step 5: Commit**

```bash
git add src/game.js index.html
git commit -m "feat: add game loop and page; Sumo Random is playable

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Playtest tuning

**Files:**
- Modify: `src/config.js` (only `PHYSICS` and `MOVES` values)

**Interfaces:**
- Consumes: the playable game from Task 11
- Produces: tuned numbers; no new names

- [ ] **Step 1: Play several Matches with two people (or both keys) and compare against each target, changing one knob at a time**

| Target (from the agreed design) | Knob in `src/config.js` |
|---|---|
| An untouched standing Wrestler wobbles but stays up | `MOVES.upright.stiffness`, `damping`, `maxTorque` |
| A fallen Wrestler can get up with one to three well-timed presses, but not with random mashing | `MOVES.chargeSpeed`, `MOVES.upright.maxAngle` |
| A typical Bout lasts 2-5 seconds but can run longer | `MOVES.chargeSpeed`, `PHYSICS.friction.leg` |
| A Belly Bump clearly throws harder than any other hit | `MOVES.bellyBump.boost`, `minSpeed` |
| The belly is a little extra bouncy | `PHYSICS.restitution.belly` |
| The Charge pose reads as a belly thrust (arms and head back) | `MOVES.chargeMotor.*` |

- [ ] **Step 2: After every change run the tests**

Run: `npm test`
Expected: PASS. The tests lock in the rules and the Plop-in timing; if a tuning change breaks one, change the tuning, not the test.

- [ ] **Step 3: Commit the tuned values with a note of what changed and why**

```bash
git add src/config.js
git commit -m "tune: playtest physics and move values

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
