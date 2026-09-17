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
