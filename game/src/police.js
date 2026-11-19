// The wanted system: heat from crimes, stars from heat, police cars that hunt
// the player, foot cops at higher heat, roadblocks at three stars and up,
// and the slow cool-down that lets a careful driver slip away.

import { POLICE, WANTED, WORLD } from './config.js';
import { makeCar, stepPoliceCar } from './vehicles.js';
import { spawnCopFoot } from './pedestrians.js';

export function createWanted() {
  return { heat: 0, stars: 0, sinceCrime: 99, bustTimer: 0 };
}

export function wantedStars(state) {
  return state.wanted.stars;
}

export function addHeat(state, amount, reason) {
  const w = state.wanted;
  const before = w.stars;
  w.heat = Math.min(WANTED.heatPerStar * WANTED.maxStars, w.heat + amount);
  w.stars = Math.min(WANTED.maxStars, Math.ceil(w.heat / WANTED.heatPerStar));
  w.sinceCrime = 0;
  if (w.stars > before) {
    state.events.message = `Wanted level ${w.stars} star${w.stars > 1 ? 's' : ''} — ${reason}`;
    state.audio.sirenBurst();
  }
}

function clearHeat(state) {
  state.wanted.heat = 0;
  state.wanted.stars = 0;
  state.wanted.sinceCrime = 99;
  // The cops give up and drive off.
  for (const car of state.cars) {
    if (car.driver === 'police') car.driver = 'traffic';
  }
  for (const ped of state.peds) {
    if (ped.role === 'cop') ped.dead = true;
  }
  state.roadblock = null;
}

function nearestCopDistance(state) {
  const target = state.player.car || state.player;
  let best = Infinity;
  for (const car of state.cars) {
    if (car.driver !== 'police') continue;
    best = Math.min(best, Math.hypot(car.x - target.x, car.y - target.y));
  }
  for (const ped of state.peds) {
    if (ped.role !== 'cop' || ped.dead) continue;
    best = Math.min(best, Math.hypot(ped.x - target.x, ped.y - target.y));
  }
  return best;
}

function spawnPoliceCar(state, random) {
  const target = state.player.car || state.player;
  // Spawn on a road, off-screen from the player.
  for (let tries = 0; tries < 10; tries += 1) {
    const p = state.city.randomRoadPoint(random);
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (d > POLICE.spawnDistance || d < 700) continue;
    const car = makeCar(state.city, random, { x: p.x, y: p.y, angle: 0, driver: 'police', color: '#2f6fd6' });
    return car;
  }
  return null;
}

function spawnRoadblock(state, random) {
  const target = state.player.car || state.player;
  const road = state.city.nearestRoadPoint(target.x + (random() - 0.5) * 400, target.y + (random() - 0.5) * 400);
  if (!road) return null;
  const vertical = road.vertical;
  const cars = [];
  for (let i = -1; i <= 1; i += 1) {
    const x = vertical ? road.x + i * 0 : road.x + i * 60;
    const y = vertical ? road.y + i * 60 : road.y;
    const car = makeCar(state.city, random, {
      x: vertical ? road.x : x,
      y: vertical ? y : road.y,
      angle: vertical ? 0 : Math.PI / 2,
      driver: 'roadblock',
      color: '#2f6fd6',
    });
    cars.push(car);
  }
  return { x: road.x, y: road.y, cars, timer: 14 };
}

export function stepPolice(state, dt, random) {
  const w = state.wanted;
  w.sinceCrime += dt;
  const target = state.player.car || state.player;

  // Cool down when unseen and quiet.
  if (w.stars > 0 && w.sinceCrime > WANTED.coolDelay) {
    const near = nearestCopDistance(state);
    if (near > 650) {
      w.heat = Math.max(0, w.heat - WANTED.coolRate * dt);
      const stars = Math.ceil(w.heat / WANTED.heatPerStar);
      if (stars < w.stars) {
        w.stars = stars;
        state.events.message = stars === 0 ? 'You lost them. The heat is off.' : `Wanted down to ${stars} star${stars === 1 ? '' : 's'}`;
        if (stars === 0) clearHeat(state);
      }
    }
  }

  // Keep the right number of police cars on the road.
  const wantCars = Math.min(POLICE.maxCars, w.stars);
  let haveCars = 0;
  for (const car of state.cars) if (car.driver === 'police' && !car.dead) haveCars += 1;
  if (w.stars > 0 && haveCars < wantCars && Math.random() < dt * 1.5) {
    const car = spawnPoliceCar(state, random);
    if (car) state.cars.push(car);
  }

  // Chase and ram.
  for (const car of state.cars) {
    if (car.driver !== 'police' || car.dead) continue;
    const dist = stepPoliceCar(state, car, dt);
    // Ramming the player hurts them (and the car).
    const pd = Math.hypot(car.x - target.x, car.y - target.y);
    if (pd < 40 && Math.abs(car.speed) > 120) {
      if (state.player.car) {
        state.player.car.hp -= 6;
        state.events.crash = true;
        state.audio.crash();
        car.speed *= 0.4;
      } else {
        state.events.ram = { amount: POLICE.ramDamage };
      }
      car.speed *= 0.5;
    }
    if (dist > POLICE.despawnDistance && w.stars === 0) car.driver = 'traffic';
  }

  // Foot cops at two stars and up, when the player is on foot.
  if (w.stars >= 2 && !state.player.car) {
    let cops = 0;
    for (const ped of state.peds) if (ped.role === 'cop' && !ped.dead) cops += 1;
    if (cops < w.stars && Math.random() < dt * 0.8) {
      const a = Math.random() * Math.PI * 2;
      const x = target.x + Math.cos(a) * 420;
      const y = target.y + Math.sin(a) * 420;
      if (x > 20 && x < WORLD.width - 20 && y > 20 && y < WORLD.height - 20) {
        state.peds.push(spawnCopFoot(state, random, x, y));
      }
    }
  }

  // Busted: a foot cop stands on the player long enough.
  if (!state.player.car && w.stars > 0) {
    let touching = false;
    for (const ped of state.peds) {
      if (ped.role !== 'cop' || ped.dead) continue;
      if (Math.hypot(ped.x - target.x, ped.y - target.y) < WANTED.bustRadius) { touching = true; break; }
    }
    if (touching) {
      w.bustTimer += dt;
      if (w.bustTimer > WANTED.bustTime) {
        state.player.busted = true;
        state.player.dead = true;
      }
    } else {
      w.bustTimer = 0;
    }
  }

  // Roadblocks at three stars and up.
  if (w.stars >= 3 && !state.roadblock && state.player.car && Math.random() < dt * 0.25) {
    const block = spawnRoadblock(state, random);
    if (block) {
      state.roadblock = block;
      for (const car of block.cars) state.cars.push(car);
      state.events.message = 'Roadblock ahead!';
      state.audio.sirenBurst();
    }
  }
  if (state.roadblock) {
    state.roadblock.timer -= dt;
    if (state.roadblock.timer <= 0) {
      for (const car of state.roadblock.cars) car.driver = 'traffic';
      state.roadblock = null;
    }
  }
}

export { clearHeat };
