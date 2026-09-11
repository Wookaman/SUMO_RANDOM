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
