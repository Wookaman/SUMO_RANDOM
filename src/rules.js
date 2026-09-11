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
