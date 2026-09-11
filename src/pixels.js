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
