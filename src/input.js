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
