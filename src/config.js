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
