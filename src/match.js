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
