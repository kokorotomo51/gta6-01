// The player on foot: walking, stealing cars, shooting, taking damage.
// Driving itself lives in vehicles.js; this module is everything outside a car.

import { CAR, PLAYER, WEAPONS } from './config.js';
import { addHeat } from './police.js';
import { scarePeds } from './pedestrians.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: 0,
    vx: 0, vy: 0,
    health: PLAYER.health,
    armor: 0,
    cash: 150,
    car: null, // the car object while driving, else null
    weapon: 'pistol',
    weapons: ['pistol'],
    ammo: { pistol: Infinity, smg: 0, rifle: 0 },
    mag: { pistol: 12, smg: 0, rifle: 0 },
    reloadTimer: 0,
    shootTimer: 0,
    invulnerable: 0,
    dead: false,
    busted: false,
    moving: false,
  };
}

export function stepPlayerOnFoot(state, dt, input) {
  const p = state.player;
  if (p.dead || p.car) return;
  const dir = input.moveVector();
  const run = input.held('ShiftLeft') || input.held('ShiftRight');
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const targetVx = dir.x * speed;
  const targetVy = dir.y * speed;
  p.vx += (targetVx - p.vx) * Math.min(1, dt * 12);
  p.vy += (targetVy - p.vy) * Math.min(1, dt * 12);
  p.moving = Math.hypot(p.vx, p.vy) > 20;
  const nx = p.x + p.vx * dt;
  const ny = p.y + p.vy * dt;
  if (!state.city.circleHitsSolid(nx, p.y, PLAYER.radius)) p.x = nx;
  if (!state.city.circleHitsSolid(p.x, ny, PLAYER.radius)) p.y = ny;
  // Face the mouse while shooting is possible, else face the walk direction.
  if (input.mouseActive()) {
    p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  } else if (p.moving) {
    p.angle = Math.atan2(p.vy, p.vx);
  }
  if (p.invulnerable > 0) p.invulnerable -= dt;
  if (p.reloadTimer > 0) p.reloadTimer -= dt;
  if (p.shootTimer > 0) p.shootTimer -= dt;
}

/** The nearest car the player could steal, within reach, or null. */
export function nearestStealableCar(state) {
  const p = state.player;
  let best = null;
  let bestD = 64;
  for (const car of state.cars) {
    if (car.dead || car.driver === 'player') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Step into a car (stealing it if it has a driver), or step out of one. */
export function toggleCar(state, random) {
  const p = state.player;
  if (p.car) {
    // Step out beside the car.
    const car = p.car;
    car.driver = 'parked';
    car.speed *= 0.3;
    const side = Math.cos(car.angle + Math.PI / 2);
    const sideY = Math.sin(car.angle + Math.PI / 2);
    p.x = car.x + side * 34;
    p.y = car.y + sideY * 34;
    p.car = null;
    p.angle = car.angle;
    state.events.message = 'Out of the car';
    return;
  }
  const car = nearestStealableCar(state);
  if (!car) return;
  const wasTraffic = car.driver === 'traffic';
  const wasParked = car.driver === 'parked';
  const wasPolice = car.driver === 'police';
  car.driver = 'player';
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (wasTraffic) {
    addHeat(state, 20, 'carjack');
    state.events.message = 'Carjacked! The police are coming.';
    state.audio.carjack();
  } else if (wasPolice) {
    addHeat(state, 45, 'stole police car');
    state.events.message = 'You stole a police car!';
    state.audio.carjack();
  } else if (wasParked) {
    state.events.message = 'Borrowed a parked car';
    state.audio.door();
  }
  // The driver, if any, runs away on foot.
  if (wasTraffic) {
    const ped = state.peds.find((q) => !q.dead && Math.hypot(q.x - car.x, q.y - car.y) < 120);
    if (ped) { ped.state = 'flee'; ped.fleeTimer = 4; }
  }
}

/** Fire the current weapon toward the mouse. */
export function playerShoot(state, input, dt) {
  const p = state.player;
  if (p.dead || p.car || p.reloadTimer > 0 || p.shootTimer > 0) return;
  if (!input.mouseDown()) return;
  const w = WEAPONS[p.weapon];
  if (p.ammo[p.weapon] !== Infinity && p.mag[p.weapon] <= 0) {
    startReload(state);
    return;
  }
  p.shootTimer = w.rate;
  if (p.ammo[p.weapon] !== Infinity) {
    p.mag[p.weapon] -= 1;
    p.ammo[p.weapon] -= 1;
  }
  const base = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  const spread = (Math.random() - 0.5) * w.spread * 2;
  const a = base + spread;
  state.bullets.push({
    x: p.x + Math.cos(a) * 20,
    y: p.y + Math.sin(a) * 20,
    vx: Math.cos(a) * w.speed,
    vy: Math.sin(a) * w.speed,
    life: w.range / w.speed,
    damage: w.damage,
    from: 'player',
  });
  state.events.gunshot = true;
  state.events.gunshotAt = { x: p.x, y: p.y };
  state.audio.shot(p.weapon);
  addHeat(state, 2, 'gunfire');
  scarePeds(state, p.x, p.y, 420);
}

export function startReload(state) {
  const p = state.player;
  const w = WEAPONS[p.weapon];
  if (p.ammo[p.weapon] === Infinity) { p.mag[p.weapon] = w.mag; return; }
  if (p.ammo[p.weapon] <= 0) {
    state.events.message = `No ${w.name} ammo — visit Solmarina Arms`;
    return;
  }
  if (p.reloadTimer > 0) return;
  p.reloadTimer = w.reload;
  const take = Math.min(w.mag, p.ammo[p.weapon]);
  p.mag[p.weapon] = take;
  state.audio.reload();
}

export function finishReloadTick(state, dt) {
  const p = state.player;
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) {
      p.reloadTimer = 0;
      state.events.message = `${WEAPONS[p.weapon].name} reloaded`;
    }
  }
}

/** Damage the player (bullets, rams, explosions); armor absorbs first. */
export function damagePlayer(state, amount, source) {
  const p = state.player;
  if (p.dead || p.invulnerable > 0) return;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.7);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  p.invulnerable = 0.35;
  state.events.hurt = true;
  state.audio.hurt();
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    state.events.message = source === 'busted' ? 'BUSTED' : 'WASTED';
  }
}

export function healPlayer(state, amount) {
  const p = state.player;
  p.health = Math.min(PLAYER.health, p.health + amount);
}
