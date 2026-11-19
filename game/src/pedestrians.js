// Pedestrians: the people of Solmarina. They stroll the sidewalks, run from
// gunfire and speeding cars, hail taxis, and — in the dockside mission — fight.

import { WORLD } from './config.js';

const PED_COLORS = ['#e86a8a', '#3aa88f', '#d9a441', '#7ab648', '#8a5fc0', '#e8e3d5', '#5a7bd9', '#c96f4a'];
const PED_NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felix', 'Gina', 'Hugo', 'Ines', 'Jorge', 'Lena', 'Marco', 'Nina', 'Omar', 'Paula', 'Rosa', 'Tomas', 'Vera'];

let nextPedId = 1;

export function makePed(state, random, opts) {
  const p = state.city.randomSidewalkPoint(random);
  return {
    id: nextPedId,
    name: PED_NAMES[Math.floor(random() * PED_NAMES.length)],
    x: opts.x ?? p.x,
    y: opts.y ?? p.y,
    angle: random() * Math.PI * 2,
    speed: 42 + random() * 26,
    color: PED_COLORS[Math.floor(random() * PED_COLORS.length)],
    role: opts.role || 'walker', // walker | fare | gang | cop
    state: 'walk',
    target: null,
    wait: 0,
    health: opts.health || 100,
    weapon: opts.weapon || null,
    shootTimer: 0,
    dead: false,
    fare: null, // {x, y, pay} when role === 'fare'
    fleeTimer: 0,
    panic: 0,
  };
}

function randomNearbySidewalk(state, ped, random) {
  for (let tries = 0; tries < 8; tries += 1) {
    const p = state.city.randomSidewalkPoint(random);
    if (Math.hypot(p.x - ped.x, p.y - ped.y) < 700) return p;
  }
  return state.city.randomSidewalkPoint(random);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function stepWalk(state, ped, dt, random) {
  if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 12) {
    if (ped.wait > 0) {
      ped.wait -= dt;
      return;
    }
    ped.target = randomNearbySidewalk(state, ped, random);
    ped.wait = 1 + random() * 4;
  }
  const a = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
  ped.angle = a;
  const nx = ped.x + Math.cos(a) * ped.speed * dt;
  const ny = ped.y + Math.sin(a) * ped.speed * dt;
  if (!state.city.circleHitsSolid(nx, ny, 10)) {
    ped.x = nx;
    ped.y = ny;
  } else {
    ped.target = randomNearbySidewalk(state, ped, random);
  }
}

function stepFlee(state, ped, dt, random) {
  ped.fleeTimer -= dt;
  const threat = state.player.car || state.player;
  const a = angleTo(threat.x, threat.y, ped.x, ped.y);
  ped.angle = a;
  const speed = ped.speed * 2.6;
  const nx = ped.x + Math.cos(a) * speed * dt;
  const ny = ped.y + Math.sin(a) * speed * dt;
  if (!state.city.circleHitsSolid(nx, ny, 10)) {
    ped.x = nx;
    ped.y = ny;
  }
  ped.x = Math.max(16, Math.min(WORLD.width - 16, ped.x));
  ped.y = Math.max(16, Math.min(WORLD.height - 16, ped.y));
  if (ped.fleeTimer <= 0 && ped.panic <= 0) ped.state = 'walk';
}

/** A gang member hunts the player: close in, then shoot. */
function stepGang(state, ped, dt, random) {
  const target = state.player.car || state.player;
  const dx = target.x - ped.x;
  const dy = target.y - ped.y;
  const dist = Math.hypot(dx, dy);
  ped.angle = Math.atan2(dy, dx);
  if (dist > 300) {
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * 2.4 * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * 2.4 * dt;
    if (!state.city.circleHitsSolid(nx, ny, 10)) { ped.x = nx; ped.y = ny; }
  } else if (dist < 120) {
    const nx = ped.x - Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y - Math.sin(ped.angle) * ped.speed * dt;
    if (!state.city.circleHitsSolid(nx, ny, 10)) { ped.x = nx; ped.y = ny; }
  }
  ped.shootTimer -= dt;
  if (ped.shootTimer <= 0 && dist < 460) {
    ped.shootTimer = 0.7 + random() * 0.8;
    const spread = (random() - 0.5) * 0.35;
    state.bullets.push({
      x: ped.x + Math.cos(ped.angle) * 18,
      y: ped.y + Math.sin(ped.angle) * 18,
      vx: Math.cos(ped.angle + spread) * 780,
      vy: Math.sin(ped.angle + spread) * 780,
      life: 0.8, damage: 8, from: 'gang',
    });
    state.events.gunshot = true;
    state.events.gunshotAt = { x: ped.x, y: ped.y };
  }
}

function stepCopFoot(state, ped, dt, random) {
  const target = state.player.car || state.player;
  const dx = target.x - ped.x;
  const dy = target.y - ped.y;
  const dist = Math.hypot(dx, dy);
  ped.angle = Math.atan2(dy, dx);
  if (dist > 60) {
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * 2.6 * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * 2.6 * dt;
    if (!state.city.circleHitsSolid(nx, ny, 10)) { ped.x = nx; ped.y = ny; }
  }
  ped.shootTimer -= dt;
  if (ped.shootTimer <= 0 && dist < 420 && !state.player.car) {
    ped.shootTimer = 0.55 + random() * 0.5;
    const spread = (random() - 0.5) * 0.3;
    state.bullets.push({
      x: ped.x + Math.cos(ped.angle) * 18,
      y: ped.y + Math.sin(ped.angle) * 18,
      vx: Math.cos(ped.angle + spread) * 800,
      vy: Math.sin(ped.angle + spread) * 800,
      life: 0.8, damage: 7, from: 'cop',
    });
    state.events.gunshot = true;
    state.events.gunshotAt = { x: ped.x, y: ped.y };
  }
}

export function stepPed(state, ped, dt, random) {
  if (ped.dead) return;
  // Panic: gunfire nearby or a car about to hit them.
  if (ped.panic > 0) ped.panic -= dt;
  if (ped.role === 'gang') { stepGang(state, ped, dt, random); return; }
  if (ped.role === 'cop') { stepCopFoot(state, ped, dt, random); return; }
  if (ped.role === 'fare' && ped.state === 'wait') return; // hailing, stands still
  if (ped.state === 'flee') { stepFlee(state, ped, dt, random); return; }
  stepWalk(state, ped, dt, random);
}

/** Scare every pedestrian near a point (a gunshot, a crash). */
export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.dead || ped.role === 'gang' || ped.role === 'cop') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee';
      ped.fleeTimer = 2.5 + Math.random() * 2;
      ped.panic = 3;
    }
  }
}

export function spawnWalker(state, random) {
  const ped = makePed(state, random, {});
  if (Math.hypot(ped.x - state.player.x, ped.y - state.player.y) < 420) return null;
  return ped;
}

export function spawnFarePed(state, random) {
  const ped = makePed(state, random, { role: 'fare' });
  ped.state = 'wait';
  const dest = state.city.randomRoadPoint(random);
  ped.fare = { x: dest.x, y: dest.y, pay: 0 };
  return ped;
}

export function spawnGang(state, random, x, y) {
  const ped = makePed(state, random, { role: 'gang', health: 100, weapon: 'pistol', x, y });
  ped.state = 'walk';
  return ped;
}

export function spawnCopFoot(state, random, x, y) {
  const ped = makePed(state, random, { role: 'cop', health: 100, weapon: 'pistol', x, y });
  ped.color = '#2f6fd6';
  return ped;
}
