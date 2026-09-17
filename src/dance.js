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
