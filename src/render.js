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
