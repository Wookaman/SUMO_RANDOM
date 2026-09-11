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
