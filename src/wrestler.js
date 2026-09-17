(function () {
  'use strict';
  const Sumo = (globalThis.Sumo = globalThis.Sumo || {});

  const PART_NAMES = ['belly', 'head', 'armN', 'armF', 'legN', 'legF'];

  // One ragdoll. (x, y) is the belly centre in pixels; facing is 1 (right) or -1 (left).
  // The skeleton is left/right symmetric, so turning around never needs the bodies rebuilt.
  function create(world, player, x, y, facing) {
    const { planck } = globalThis;
    const { PPM, WRESTLER: G, PHYSICS: PH } = Sumo.CONFIG;
    const m = (px) => px / PPM;
    const def = (part, extra) => ({
      filterGroupIndex: -player, // a Wrestler's own parts never collide
      userData: { player, part },
      friction: PH.friction.body,
      restitution: PH.restitution.body,
      ...extra,
    });
    const body = (px, py) => world.createBody({ type: 'dynamic', position: { x: m(px), y: m(py) } });

    const belly = body(x, y);
    belly.createFixture(new planck.Circle(m(G.belly.r)), def('belly', { density: PH.density.belly, restitution: PH.restitution.belly }));

    const head = body(x, y + G.head.y);
    head.createFixture(new planck.Circle(m(G.head.r)), def('head', { density: PH.density.head }));

    const arm = (part) => {
      const b = body(x, y + G.arm.shoulderY + G.arm.hh);
      b.createFixture(new planck.Box(m(G.arm.hw), m(G.arm.hh)), def(part, { density: PH.density.arm }));
      return b;
    };
    const leg = (part, side) => {
      const b = body(x + side * G.leg.hipX, y + G.leg.hipY + G.leg.hh);
      b.createFixture(new planck.Box(m(G.leg.hw), m(G.leg.hh)), def(part, { density: PH.density.leg, friction: PH.friction.leg }));
      return b;
    };
    const armN = arm('armN');
    const armF = arm('armF');
    const legN = leg('legN', facing);
    const legF = leg('legF', -facing);

    const hinge = (a, b, ax, ay, limit) =>
      world.createJoint(
        new planck.RevoluteJoint(
          { enableLimit: true, lowerAngle: -limit, upperAngle: limit, enableMotor: false, motorSpeed: 0, maxMotorTorque: 0 },
          a, b, { x: m(ax), y: m(ay) },
        ),
      );
    const joints = {
      neck: hinge(belly, head, x, y + G.head.neckY, PH.limits.neck),
      shoulderN: hinge(belly, armN, x, y + G.arm.shoulderY, PH.limits.shoulder),
      shoulderF: hinge(belly, armF, x, y + G.arm.shoulderY, PH.limits.shoulder),
      hipN: hinge(belly, legN, x + facing * G.leg.hipX, y + G.leg.hipY, PH.limits.hip),
      hipF: hinge(belly, legF, x - facing * G.leg.hipX, y + G.leg.hipY, PH.limits.hip),
    };

    return { player, facing, bodies: { belly, head, armN, armF, legN, legF }, joints, poseTimer: 0 };
  }

  function parts(w) {
    const { PPM } = Sumo.CONFIG;
    const out = {};
    for (const name of PART_NAMES) {
      const b = w.bodies[name];
      const p = b.getPosition();
      out[name] = { x: p.x * PPM, y: p.y * PPM, a: b.getAngle() };
    }
    return out;
  }

  function bellyPos(w) {
    const { PPM } = Sumo.CONFIG;
    const p = w.bodies.belly.getPosition();
    return { x: p.x * PPM, y: p.y * PPM };
  }

  function topY(w) {
    const { planck } = globalThis;
    let top = Infinity;
    for (const b of Object.values(w.bodies)) {
      const xf = b.getTransform();
      for (let f = b.getFixtureList(); f; f = f.getNext()) {
        const shape = f.getShape();
        if (f.getType() === 'circle') {
          const c = planck.Transform.mul(xf, shape.getCenter());
          top = Math.min(top, c.y - shape.getRadius());
        } else {
          for (let i = 0; i < shape.m_count; i++) top = Math.min(top, planck.Transform.mul(xf, shape.m_vertices[i]).y);
        }
      }
    }
    return top * Sumo.CONFIG.PPM;
  }

  function isGrounded(w) {
    for (const b of Object.values(w.bodies)) {
      for (let ce = b.getContactList(); ce; ce = ce.next) {
        if (ce.other.isStatic() && ce.contact.isTouching()) return true;
      }
    }
    return false;
  }

  function motor(joint, on, speed, torque) {
    joint.enableMotor(on);
    joint.setMotorSpeed(on ? speed : 0);
    joint.setMaxMotorTorque(on ? torque : 0);
  }

  // Belly leads: arms and legs swing back (+facing), head tips back (-facing). See the angle convention in the plan.
  function setChargePose(w, on) {
    const M = Sumo.CONFIG.MOVES.chargeMotor;
    const f = w.facing;
    motor(w.joints.shoulderN, on, f * M.armSpeed, M.armTorque);
    motor(w.joints.shoulderF, on, f * M.armSpeed, M.armTorque);
    motor(w.joints.hipN, on, f * M.legSpeed, M.legTorque);
    motor(w.joints.hipF, on, f * M.legSpeed, M.legTorque);
    motor(w.joints.neck, on, -f * M.neckSpeed, M.neckTorque);
  }

  function charge(w) {
    if (!isGrounded(w)) return false;
    const { MOVES } = Sumo.CONFIG;
    const dir = Sumo.rules.chargeDirection(w.bodies.belly.getAngle(), w.facing, MOVES.chargeElevation);
    for (const b of Object.values(w.bodies)) {
      const k = MOVES.chargeSpeed * b.getMass(); // same speed kick for every part, so the ragdoll moves as one
      b.applyLinearImpulse({ x: dir.x * k, y: dir.y * k }, b.getWorldCenter(), true);
    }
    setChargePose(w, true);
    w.poseTimer = MOVES.chargePoseTime;
    return true;
  }

  function update(w, dt, otherBellyX, upright) {
    const { MOVES } = Sumo.CONFIG;
    const belly = w.bodies.belly;
    if (otherBellyX !== null) w.facing = Sumo.rules.facingToward(bellyPos(w).x, otherBellyX, w.facing);
    if (upright) belly.applyTorque(Sumo.rules.uprightTorque(belly.getAngle(), belly.getAngularVelocity(), MOVES.upright), true);
    if (w.poseTimer > 0) {
      w.poseTimer -= dt;
      if (w.poseTimer <= 0) {
        w.poseTimer = 0;
        setChargePose(w, false);
      }
    }
  }

  function destroy(world, w) {
    for (const b of Object.values(w.bodies)) world.destroyBody(b);
  }

  Sumo.wrestler = { create, parts, bellyPos, topY, isGrounded, charge, update, destroy };
})();
