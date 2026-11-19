// Cars: the player's arcade driving, the traffic that fills the roads, and the
// police cars that chase. All cars are the same shape; only the driver differs.

import { CAR, CITY, PALETTE, WORLD } from './config.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8e3d5', '#4a4a52', '#d9a441', '#7ab648', '#8a5fc0', '#c9c2ae', '#e86a8a', '#3aa88f'];
const SPORTS_COLORS = ['#ffd23f', '#ff5a3c', '#19c2e6', '#f2f2f2'];

let nextCarId = 1;

export function makeCar(city, random, opts) {
  const kind = opts.kind || 'sedan';
  const maxSpeed = kind === 'sports' ? CAR.sportsMaxSpeed : CAR.maxSpeed * (0.82 + random() * 0.18);
  const color = opts.color || (kind === 'sports'
    ? SPORTS_COLORS[Math.floor(random() * SPORTS_COLORS.length)]
    : CAR_COLORS[Math.floor(random() * CAR_COLORS.length)]);
  return {
    id: nextCarId,
    kind,
    x: opts.x, y: opts.y, angle: opts.angle || 0,
    speed: 0, steer: 0,
    color,
    driver: opts.driver || 'traffic', // traffic | player | police | parked | golden
    hp: 100,
    route: null,
    routeIndex: 0,
    stuck: 0,
    siren: 0,
    dead: false,
    honk: 0,
  };
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** A fresh route along the road grid: a list of waypoints the car follows. */
export function makeRoute(city, random, start) {
  const points = [];
  let x = start.x;
  let y = start.y;
  let vertical = Math.abs(x - city.roadsV[0]) < 200 || random() < 0.5;
  for (let i = 0; i < 6; i += 1) {
    if (vertical) {
      const rx = city.roadsV[Math.floor(random() * city.roadsV.length)];
      const lane = random() < 0.5 ? -32 : 32;
      points.push({ x: rx + lane, y });
      const ry = city.roadsH[Math.floor(random() * city.roadsH.length)];
      points.push({ x: rx + lane, y: ry });
      x = rx + lane;
      y = ry;
    } else {
      const ry = city.roadsH[Math.floor(random() * city.roadsH.length)];
      const lane = random() < 0.5 ? -32 : 32;
      points.push({ x, y: ry + lane });
      const rx = city.roadsV[Math.floor(random() * city.roadsV.length)];
      points.push({ x: rx, y: ry + lane });
      x = rx;
      y = ry + lane;
    }
    vertical = !vertical;
  }
  return points;
}

export function spawnTrafficCar(state, random) {
  const p = state.city.randomRoadPoint(random);
  const nearPlayer = Math.hypot(p.x - state.player.x, p.y - state.player.y) < 500;
  if (nearPlayer) return null;
  const vertical = state.city.roadsV.some((rx) => Math.abs(p.x - rx) < 70);
  const angle = vertical ? (p.y < WORLD.height / 2 ? Math.PI / 2 : -Math.PI / 2) : (p.x < WORLD.width / 2 ? 0 : Math.PI);
  const car = makeCar(state.city, random, { x: p.x, y: p.y, angle, driver: 'traffic' });
  car.route = makeRoute(state.city, random, p);
  car.routeIndex = 0;
  car.speed = CAR.trafficSpeed * 0.8;
  return car;
}

export function spawnParkedCar(state, random) {
  const p = state.city.randomRoadPoint(random);
  const vertical = state.city.roadsV.some((rx) => Math.abs(p.x - rx) < 70);
  const angle = vertical ? Math.PI / 2 : 0;
  const offset = random() < 0.5 ? -52 : 52;
  const x = vertical ? p.x + offset : p.x;
  const y = vertical ? p.y : p.y + offset;
  if (state.city.circleHitsSolid(x, y, 30)) return null;
  if (Math.hypot(x - state.player.x, y - state.player.y) < 420) return null;
  return makeCar(state.city, random, { x, y, angle, driver: 'parked' });
}

/** Move a car one step with arcade physics; returns true if it hit a wall. */
export function moveCar(state, car, dt, throttle, steerInput) {
  const maxSpeed = car.kind === 'sports' ? CAR.sportsMaxSpeed : CAR.maxSpeed;
  const accel = throttle > 0 ? CAR.accel * throttle : throttle < 0 ? CAR.reverseAccel * -throttle : 0;
  car.speed += accel * dt;
  car.speed -= car.speed * CAR.drag * dt;
  if (throttle === 0 && Math.abs(car.speed) < 12) car.speed = 0;
  car.speed = Math.max(-CAR.maxReverse, Math.min(maxSpeed, car.speed));
  const steerAmount = CAR.steer * steerInput * Math.min(1, Math.abs(car.speed) / 140) * Math.sign(car.speed || 1);
  car.angle += steerAmount * dt * (car.speed >= 0 ? 1 : -1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Walls: slide along them instead of stopping dead.
  let hit = false;
  if (!state.city.circleHitsSolid(nx, car.y, 15)) car.x = nx;
  else { car.speed *= 0.55; hit = true; }
  if (!state.city.circleHitsSolid(car.x, ny, 15)) car.y = ny;
  else { car.speed *= 0.55; hit = true; }
  car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD.height - 20, car.y));
  return hit;
}

function carsOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < 34 * 34;
}

/** Push two overlapping cars apart so traffic does not pile into one spot. */
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.dead) continue;
      if (!carsOverlap(a, b)) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const push = (34 - d) / 2;
      const px = (dx / d) * push;
      const py = (dy / d) * push;
      if (a.driver !== 'player') { a.x -= px; a.y -= py; }
      if (b.driver !== 'player') { b.x += px; b.y += py; }
      if (a.driver === 'player' || b.driver === 'player') {
        const pc = a.driver === 'player' ? a : b;
        pc.speed *= 0.82;
      }
    }
  }
}

/** Traffic follows its route; a car that finishes its route gets a new one. */
export function stepTrafficCar(state, car, dt, random) {
  if (!car.route || car.routeIndex >= car.route.length) {
    car.route = makeRoute(state.city, random, car);
    car.routeIndex = 0;
  }
  const target = car.route[car.routeIndex];
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 26) {
    car.routeIndex += 1;
    return;
  }
  const wantAngle = Math.atan2(dy, dx);
  const diff = angleDiff(wantAngle, car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  // Slow down for the car ahead.
  let throttle = 1;
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const forward = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (forward > 0 && forward < 70 && side < 30) { throttle = 0.25; break; }
  }
  const targetSpeed = CAR.trafficSpeed * throttle;
  if (car.speed < targetSpeed) car.speed += CAR.accel * 0.6 * dt;
  else if (car.speed > targetSpeed) car.speed -= CAR.brake * 0.5 * dt;
  car.angle += CAR.steer * 0.9 * steer * Math.min(1, Math.abs(car.speed) / 120) * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!state.city.circleHitsSolid(nx, car.y, 15)) car.x = nx;
  if (!state.city.circleHitsSolid(car.x, ny, 15)) car.y = ny;
  car.siren += dt;
}

/** The nearest road centre to a point, and which axis it runs on. */
function nearestRoad(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of city.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

/**
 * A police car chases the player. Far away it navigates the road grid — drive
 * to the player's road, then along it — so it never gets stuck behind a
 * building. Close in it steers straight at the player and rams.
 */
export function stepPoliceCar(state, car, dt) {
  const target = state.player.car || state.player;
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  let wantAngle;
  if (dist < 280) {
    wantAngle = Math.atan2(dy, dx);
  } else {
    // Grid waypoint: the intersection that puts the cop on the player's road.
    const city = state.city;
    const playerRoad = nearestRoad(city, target.x, target.y);
    const myRoad = nearestRoad(city, car.x, car.y);
    let wp;
    if (myRoad.vertical === playerRoad.vertical) {
      // Same axis: head for the player's road line, then along it.
      wp = myRoad.vertical ? { x: myRoad.x, y: target.y } : { x: target.x, y: myRoad.y };
    } else if (myRoad.vertical) {
      // I am on a vertical road; turn onto the horizontal road nearest the player.
      wp = { x: myRoad.x, y: playerRoad.y };
    } else {
      // I am on a horizontal road; turn onto the vertical road nearest the player.
      wp = { x: playerRoad.x, y: myRoad.y };
    }
    // If I am not on a road yet (cutting a corner), head for my road first.
    if (!myRoad.vertical && Math.abs(car.y - myRoad.y) > 70) wp = { x: car.x, y: myRoad.y };
    if (myRoad.vertical && Math.abs(car.x - myRoad.x) > 70) wp = { x: myRoad.x, y: car.y };
    wantAngle = Math.atan2(wp.y - car.y, wp.x - car.x);
  }
  const diff = angleDiff(wantAngle, car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  const targetSpeed = dist > 700 ? CAR.policeSpeed : CAR.policeSpeed * 0.92;
  if (car.speed < targetSpeed) car.speed += CAR.accel * dt;
  else if (car.speed > targetSpeed) car.speed -= CAR.brake * 0.4 * dt;
  car.angle += CAR.steer * 1.05 * steer * Math.min(1, Math.abs(car.speed) / 120) * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  let hit = false;
  if (!state.city.circleHitsSolid(nx, car.y, 15)) car.x = nx; else hit = true;
  if (!state.city.circleHitsSolid(car.x, ny, 15)) car.y = ny; else hit = true;
  if (hit) car.speed *= 0.6;
  car.siren += dt;
  return dist;
}

export { angleDiff };
export const POLICE_COLOR = PALETTE.police;
