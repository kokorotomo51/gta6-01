// The screenshot scenes behind ?shot=street|drive|chase|mission (with &seed=N).
// Each one builds a real world from the seed, plays the rules forward for a
// fixed number of steps with a scripted driver, and paints the frame — so the
// picture is what a short game really looks like, and the same seed always
// gives the same frame.

import { STEP } from './config.js';
import { createWorld, step } from './world.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY } from './render.js';
import { makeCar } from './vehicles.js';
import { makePed, spawnGang } from './pedestrians.js';

const VIEW_SECONDS = 6;

/** Drive a car straight down its road: hold the road's direction and steer
 * gently back to its centre line if the car drifts. No U-turns. */
function autopilotDrive(state, steps) {
  const car = state.player.car;
  if (!car) return;
  const roadX = 1890; // the main avenue the staged cars start on
  for (let i = 0; i < steps; i += 1) {
    const input = {
      throttle: () => 1,
      steer: () => {
        // South down the avenue, correcting toward its centre line.
        const want = Math.PI / 2 + Math.max(-0.35, Math.min(0.35, (roadX - car.x) * 0.002));
        let d = want - car.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return Math.max(-1, Math.min(1, d * 2.5));
      },
      moveVector: () => ({ x: 0, y: 0 }),
      mouseDown: () => false,
      mouseActive: () => false,
      aimX: car.x, aimY: car.y,
      held: () => false,
      takeActions: () => 0,
    };
    step(state, STEP, input);
  }
}

function idleSteps(state, steps) {
  const input = {
    throttle: () => 0,
    steer: () => 0,
    moveVector: () => ({ x: 0, y: 0 }),
    mouseDown: () => false,
    mouseActive: () => false,
    aimX: state.player.x + 100, aimY: state.player.y,
    held: () => false,
    takeActions: () => 0,
  };
  for (let i = 0; i < steps; i += 1) step(state, STEP, input);
}

/**
 * Set the world to the named scene and return the screen to draw over it.
 * street: on foot at the Downtown plaza, traffic and pedestrians around.
 * drive: behind the wheel on the main avenue, traffic ahead.
 * chase: three stars, police cars closing in, roadblock ahead.
 * mission: the dockside shootout, objective on the HUD.
 */
export function stageShot(name, seed) {
  const state = createWorld(seed);
  const steps = Math.floor(VIEW_SECONDS / STEP);

  if (name === 'drive') {
    // Put Rio in a red sports car on the main avenue, heading south.
    const car = makeCar(state.city, state.random, { x: 1890, y: 500, angle: Math.PI / 2, driver: 'player', kind: 'sports', color: '#ff5a3c' });
    state.cars.push(car);
    state.player.car = car;
    state.player.x = car.x;
    state.player.y = car.y;
    // A few cars ahead on the same avenue, so the drive has traffic to pass.
    for (const [dx, dy] of [[-32, 420], [32, 780], [-32, 1150]]) {
      const t = makeCar(state.city, state.random, { x: 1890 + dx, y: car.y + dy, angle: Math.PI / 2, driver: 'traffic' });
      t.speed = 150;
      state.cars.push(t);
    }
    // Short drive: 2.4 s keeps the car on the avenue, mid-city.
    autopilotDrive(state, Math.floor(2.4 / STEP));
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    return { screen: SCREEN_PLAY, state };
  }

  if (name === 'chase') {
    const car = makeCar(state.city, state.random, { x: 1890, y: 900, angle: Math.PI / 2, driver: 'player', kind: 'sports', color: '#ffcf3f' });
    state.cars.push(car);
    state.player.car = car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.wanted.heat = 65;
    state.wanted.stars = 4;
    state.wanted.sinceCrime = 0;
    // Three police cars on the same avenue, closing in from behind.
    for (const [dx, dy] of [[-32, -380], [32, -560], [-32, -760]]) {
      const cop = makeCar(state.city, state.random, { x: car.x + dx, y: car.y + dy, angle: Math.PI / 2, driver: 'police', color: '#2f6fd6' });
      cop.speed = 430;
      state.cars.push(cop);
    }
    startMission(state, 4);
    state.mission.active = true;
    state.mission.step = 2; // escape to the hideout
    state.mission.marker = { x: 430, y: 2250, label: 'Hideout' };
    state.mission.currentLine = 'MARA: The whole city is after you — lose them!';
    autopilotDrive(state, Math.floor(2.0 / STEP));
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    return { screen: SCREEN_PLAY, state };
  }

  if (name === 'mission') {
    // The dockside shootout: Rio on foot, gang members ahead, one already down.
    const docks = state.city.landmarks.docks;
    state.player.x = docks.x - 220;
    state.player.y = docks.y + 60;
    state.player.angle = 0;
    state.player.weapon = 'rifle';
    state.player.weapons = ['pistol', 'smg', 'rifle'];
    state.player.ammo = { pistol: Infinity, smg: 120, rifle: 80 };
    state.player.mag = { pistol: 12, smg: 30, rifle: 20 };
    startMission(state, 3);
    state.mission.active = true;
    state.mission.step = 1; // clear the docks
    state.mission.kills = 2;
    state.mission.gangSpawned = true;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      state.peds.push(spawnGang(state, state.random, docks.x + Math.cos(a) * 130, docks.y + Math.sin(a) * 110));
    }
    // Rio fires at the nearest gang member.
    const target = state.peds.find((p) => p.role === 'gang' && !p.dead);
    if (target) {
      state.bullets.push({
        x: state.player.x + 20, y: state.player.y,
        vx: 1300, vy: 0, life: 0.5, damage: 55, from: 'player',
      });
    }
    idleSteps(state, Math.floor(steps * 0.5));
    state.camera.x = docks.x - 80;
    state.camera.y = docks.y;
    return { screen: SCREEN_PLAY, state };
  }

  // Default: street — on foot at the Downtown plaza, city alive around Rio.
  const plaza = { x: 1890, y: 1070 };
  state.player.x = plaza.x;
  state.player.y = plaza.y + 120;
  state.player.angle = -Math.PI / 2;
  startMission(state, 0);
  state.mission.active = true;
  state.mission.step = 0;
  state.mission.marker = { x: 1890, y: 1710, label: "Mara's Garage" };
  state.mission.currentLine = "MARA: Take any car on the street — and bring it to my garage.";
  idleSteps(state, steps);
  // Fill the streets around the plaza after the world settles, so the frame
  // is busy: traffic on the avenue and the cross street, pedestrians on the
  // sidewalks.
  for (const [x, y, angle] of [
    [1858, 800, Math.PI / 2], [1922, 1400, -Math.PI / 2], [1500, 1070, 0],
    [2300, 1038, Math.PI], [1858, 1700, Math.PI / 2], [1160, 1300, Math.PI / 2],
  ]) {
    const t = makeCar(state.city, state.random, { x, y, angle, driver: 'traffic' });
    t.speed = 140;
    state.cars.push(t);
  }
  for (let i = 0; i < 9; i += 1) {
    const px = plaza.x - 260 + state.random() * 520;
    const py = plaza.y - 200 + state.random() * 420;
    const ped = makePed(state, state.random, { x: px, y: py });
    if (ped && !state.city.circleHitsSolid(px, py, 10)) state.peds.push(ped);
  }
  // Frame the player and the garage marker together.
  state.camera.x = plaza.x;
  state.camera.y = plaza.y + 340;
  return { screen: SCREEN_PLAY, state };
}
