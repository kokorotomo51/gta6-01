// The world: one state object and the fixed step that advances all of it —
// the player, traffic, police, pedestrians, bullets, particles, missions,
// activities and the camera. Subsystems own their rules; this file wires
// them together and resolves what they do to each other.

import { CAR, CITY, PALETTE, STEP, WORLD } from './config.js';
import { buildCity } from './city.js';
import { createRandom } from './random.js';
import { createPlayer, damagePlayer, finishReloadTick, playerShoot, stepPlayerOnFoot, toggleCar } from './player.js';
import { makeCar, moveCar, separateCars, spawnParkedCar, spawnTrafficCar, stepTrafficCar } from './vehicles.js';
import { makePed, scarePeds, spawnGang, spawnWalker, stepPed } from './pedestrians.js';
import { createWanted, stepPolice, wantedStars } from './police.js';
import { applyStep, completeMission, createMissionState, currentMission, currentStep, failMission, onGangKilled, onGoldenStolen, startMission, stepMissions, tryPickupPackage } from './missions.js';
import { buyArmor, buyWeapon, createActivitiesState, shopNear, sprayService, stepActivities, tryPickupFare } from './activities.js';
import { createAudio } from './audio.js';
import { applySave, saveGame } from './save.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = buildCity(random);
  const garage = city.landmarks.garage;
  const state = {
    seed,
    random,
    city,
    time: 0,
    clock: 8 * 60, // 08:00 in the morning, game minutes
    player: createPlayer(garage.x - 60, garage.y + 40),
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    wanted: createWanted(),
    mission: createMissionState(),
    activities: createActivitiesState(random),
    stats: { kills: 0, fares: 0, collected: 0 },
    camera: { x: garage.x, y: garage.y },
    roadblock: null,
    events: { message: '', messageTimer: 0 },
    audio: createAudio(),
    saveTimer: 30,
    goldenCar: null,
    over: false,
    overReason: '',
  };

  // The golden sports car waits in the casino lot from the start.
  const lot = city.landmarks.goldenLot;
  const golden = makeCar(city, random, { x: lot.x, y: lot.y, angle: Math.PI / 2, driver: 'parked', kind: 'sports', color: '#ffd23f' });
  state.cars.push(golden);
  state.goldenCar = golden;

  // Opening traffic and parked cars.
  for (let i = 0; i < 11; i += 1) {
    const car = spawnTrafficCar(state, random);
    if (car) state.cars.push(car);
  }
  for (let i = 0; i < 8; i += 1) {
    const car = spawnParkedCar(state, random);
    if (car) state.cars.push(car);
  }
  for (let i = 0; i < 22; i += 1) {
    const ped = spawnWalker(state, random);
    if (ped) state.peds.push(ped);
  }
  return state;
}

/** Put a fresh world back to its opening state (same seed). */
export function resetWorld(state) {
  const fresh = createWorld(state.seed);
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, fresh);
}

function addParticles(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.4, maxLife: 0.8, color, size: 2 + Math.random() * 3 });
  }
}

function stepBullets(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (state.city.solidAt(b.x, b.y)) {
      b.life = 0;
      addParticles(state, b.x, b.y, '#e8d44f', 4, 120);
      continue;
    }
    if (b.from === 'player') {
      // Hit a pedestrian?
      for (const ped of state.peds) {
        if (ped.dead) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          b.life = 0;
          ped.health -= b.damage;
          addParticles(state, ped.x, ped.y, '#c0392b', 8, 160);
          if (ped.health <= 0) {
            ped.dead = true;
            if (ped.role === 'gang') onGangKilled(state);
            else if (ped.role === 'cop') {
              state.wanted.heat = Math.min(100, state.wanted.heat + 45);
              state.wanted.stars = Math.ceil(state.wanted.heat / 20);
            } else {
              state.wanted.heat = Math.min(100, state.wanted.heat + 22);
              state.wanted.stars = Math.ceil(state.wanted.heat / 20);
              state.events.message = 'You hit a civilian! The police are coming.';
            }
            scarePeds(state, ped.x, ped.y, 380);
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // Hit a car?
      for (const car of state.cars) {
        if (car.dead || car.driver === 'player') continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
          b.life = 0;
          car.hp -= b.damage;
          addParticles(state, b.x, b.y, '#e8d44f', 4, 120);
          if (car.hp <= 0) {
            car.dead = true;
            addParticles(state, car.x, car.y, '#ff7a3c', 22, 260);
            addParticles(state, car.x, car.y, '#3b3b44', 14, 120);
            state.audio.crash();
            if (car.driver === 'police') {
              state.wanted.heat = Math.min(100, state.wanted.heat + 20);
              state.wanted.stars = Math.ceil(state.wanted.heat / 20);
            }
          }
          break;
        }
      }
    } else {
      // Enemy bullet: the player, or the player's car.
      if (!p.car && !p.dead && Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        b.life = 0;
        damagePlayer(state, b.damage, 'shot');
        addParticles(state, p.x, p.y, '#c0392b', 5, 140);
      } else if (p.car && !p.car.dead && Math.hypot(p.car.x - b.x, p.car.y - b.y) < 26) {
        b.life = 0;
        p.car.hp -= b.damage;
        addParticles(state, b.x, b.y, '#e8d44f', 4, 120);
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

function stepParticles(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
}

function stepCarPedCollisions(state) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    for (const car of state.cars) {
      if (car.dead) continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d > 30) continue;
      if (car.driver === 'player' && Math.abs(car.speed) > 90) {
        // The player ran someone over.
        ped.dead = true;
        addParticles(state, ped.x, ped.y, '#c0392b', 10, 180);
        state.wanted.heat = Math.min(100, state.wanted.heat + 22);
        state.wanted.stars = Math.ceil(state.wanted.heat / 20);
        state.events.message = 'You ran over a pedestrian!';
        state.audio.crash();
        scarePeds(state, ped.x, ped.y, 380);
        car.speed *= 0.7;
      } else if (Math.abs(car.speed) > 40) {
        // Traffic bumps a pedestrian aside; they run off.
        ped.state = 'flee';
        ped.fleeTimer = 2;
        const a = Math.atan2(ped.y - car.y, ped.x - car.x);
        ped.x += Math.cos(a) * 26;
        ped.y += Math.sin(a) * 26;
      }
    }
    // The player on foot bumping into people just pushes past.
    if (!p.car && !p.dead && Math.hypot(ped.x - p.x, ped.y - p.y) < 22) {
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.x += Math.cos(a) * 8;
      ped.y += Math.sin(a) * 8;
    }
  }
}

function maintainPopulation(state, random) {
  const p = state.player;
  // Traffic: keep about a dozen cars on the roads.
  let traffic = 0;
  for (const car of state.cars) if (car.driver === 'traffic' && !car.dead) traffic += 1;
  if (traffic < 11 && Math.random() < 0.1) {
    const car = spawnTrafficCar(state, random);
    if (car) state.cars.push(car);
  }
  // Parked cars: keep the streets lined.
  let parked = 0;
  for (const car of state.cars) if (car.driver === 'parked' && !car.dead) parked += 1;
  if (parked < 7 && Math.random() < 0.05) {
    const car = spawnParkedCar(state, random);
    if (car) state.cars.push(car);
  }
  // Pedestrians: keep the sidewalks alive.
  let walkers = 0;
  for (const ped of state.peds) if (!ped.dead) walkers += 1;
  if (walkers < 20 && Math.random() < 0.1) {
    const ped = spawnWalker(state, random);
    if (ped) state.peds.push(ped);
  }
  // Sweep the dead.
  state.cars = state.cars.filter((c) => !c.dead || c === state.goldenCar);
  state.peds = state.peds.filter((q) => !q.dead || q.role === 'fare');
  // A fare that died riding with the player cancels the ride.
  if (state.activities.activeFare && state.activities.activeFare.dead) {
    state.activities.activeFare = null;
    state.activities.fareTarget = null;
  }
}

function updateCamera(state) {
  const target = state.player.car || state.player;
  const tx = Math.max(640, Math.min(WORLD.width - 640, target.x));
  const ty = Math.max(400, Math.min(WORLD.height - 400, target.y));
  state.camera.x += (tx - state.camera.x) * 0.12;
  state.camera.y += (ty - state.camera.y) * 0.12;
}

/** The E key: enter a car, pick up a fare or a package, open a shop. */
export function interact(state) {
  const p = state.player;
  const shop = shopNear(state);
  if (shop) {
    state.activities.shop = state.activities.shop === shop ? null : shop;
    return;
  }
  if (tryPickupFare(state)) return;
  if (tryPickupPackage(state)) return;
  toggleCar(state, state.random);
  // Stealing the golden car triggers mission 5's escape.
  if (p.car === state.goldenCar && !state.mission.goldenStolen) {
    onGoldenStolen(state);
  }
}

/** One fixed step of the whole game. `input` may be null in shot mode. */
export function step(state, dt, input) {
  state.time += dt;
  state.clock = (state.clock + dt * 1.5) % (24 * 60);
  const p = state.player;
  const random = state.random;

  // Mission events the step machine asked for.
  if (state.events.spawnGang) {
    state.events.spawnGang = false;
    const docks = state.city.landmarks.docks;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      state.peds.push(spawnGang(state, random, docks.x + Math.cos(a) * 150, docks.y + Math.sin(a) * 120));
    }
    state.events.message = 'Red Tide gang at the docks — take them down!';
  }
  if (state.events.spawnGolden) {
    state.events.spawnGolden = false;
    // The golden car is already parked in the casino lot; point at it.
    state.mission.marker = { x: state.goldenCar.x, y: state.goldenCar.y, label: 'The Golden Gull' };
  }

  // Toast messages fade: a new message (re)set its timer.
  if (state.events.message && state.events.message !== state.events._lastMessage) {
    state.events._lastMessage = state.events.message;
    state.events.messageTimer = 3.5;
  }
  if (state.events.messageTimer > 0) {
    state.events.messageTimer -= dt;
    if (state.events.messageTimer <= 0) {
      state.events.message = '';
      state.events._lastMessage = '';
    }
  }

  // Player: drive or walk, shoot, reload.
  if (input && !p.dead) {
    if (p.car) {
      const throttle = input.throttle();
      const steer = input.steer();
      const hitWall = moveCar(state, p.car, dt, throttle, steer);
      if (hitWall && Math.abs(p.car.speed) > 240) {
        p.car.hp -= 4;
        state.audio.crash();
        addParticles(state, p.car.x, p.car.y, '#e8d44f', 5, 120);
      }
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
      state.audio.engine(p.car.speed, p.car.kind === 'sports' ? 660 : 540);
      if (p.car.hp <= 0) {
        // The car blows up; the player is thrown clear.
        addParticles(state, p.car.x, p.car.y, '#ff7a3c', 26, 300);
        addParticles(state, p.car.x, p.car.y, '#3b3b44', 16, 140);
        state.audio.crash();
        p.car.dead = true;
        p.car = null;
        p.x += 40;
        p.y += 40;
        damagePlayer(state, 25, 'crash');
        state.events.message = 'Your car is wrecked!';
      }
    } else {
      stepPlayerOnFoot(state, dt, input);
      playerShoot(state, input, dt);
      finishReloadTick(state, dt);
      state.audio.engineOff();
    }
  }

  // Traffic and police cars.
  for (const car of state.cars) {
    if (car.dead) continue;
    if (car.driver === 'traffic') stepTrafficCar(state, car, dt, random);
  }
  separateCars(state.cars);

  // Pedestrians.
  for (const ped of state.peds) stepPed(state, ped, dt, random);

  // Bullets, particles, collisions.
  stepBullets(state, dt);
  stepParticles(state, dt);
  stepCarPedCollisions(state);

  // The ram event from police: damage the player on foot.
  if (state.events.ram) {
    damagePlayer(state, state.events.ram.amount, 'ram');
    state.events.ram = null;
  }

  // Wanted, missions, activities.
  stepPolice(state, dt, random);
  stepMissions(state, dt);
  stepActivities(state, dt, random);
  maintainPopulation(state, random);
  updateCamera(state);

  // Siren while wanted.
  state.audio.siren(dt, wantedStars(state) > 0);

  // Autosave every 30 seconds of play.
  state.saveTimer -= dt;
  if (state.saveTimer <= 0) {
    state.saveTimer = 30;
    saveGame(state);
  }

  if (p.dead) {
    state.over = true;
    state.overReason = p.busted ? 'busted' : 'wasted';
  }
}

/** Respawn after WASTED / BUSTED: hospital, some cash lost, heat cleared. */
export function respawn(state) {
  const p = state.player;
  const hospital = state.city.landmarks.hospital;
  p.x = hospital.x;
  p.y = hospital.y + 60;
  p.car = null;
  p.health = 100;
  p.armor = 0;
  p.dead = false;
  p.busted = false;
  p.invulnerable = 2;
  const lost = Math.floor(p.cash * 0.1);
  p.cash -= lost;
  state.wanted.heat = 0;
  state.wanted.stars = 0;
  state.wanted.sinceCrime = 99;
  state.wanted.bustTimer = 0;
  for (const car of state.cars) if (car.driver === 'police') car.driver = 'traffic';
  for (const ped of state.peds) if (ped.role === 'cop') ped.dead = true;
  state.roadblock = null;
  state.over = false;
  state.overReason = '';
  state.events.message = lost > 0 ? `Hospital bill: -$${lost}` : 'Patched up at Solmarina General';
  // A failed mission can be retried with N.
  if (state.mission.failed) state.mission.failed = false;
}

export { addParticles };
