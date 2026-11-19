// SOLMARINA — every tuning number, colour and city constant in one place.
// The world is a fixed 3600x2600 pixel city; the renderer shows a camera-sized
// window of it, so no rule below depends on the screen size.

export const WORLD = { width: 3600, height: 2600 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const CITY = {
  // Road centre lines. Roads are 130 px wide with 14 px sidewalks on each side.
  roadsV: [430, 1160, 1890, 2620, 3250],
  roadsH: [430, 1070, 1710, 2250],
  roadWidth: 130,
  sidewalk: 14,
  // South edge: sand then sea.
  sandTop: 2400,
  seaTop: 2510,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 265,
  runSpeed: 340,
  health: 100,
  armor: 100,
  invulnerable: 1.2,
};

export const CAR = {
  length: 54,
  width: 26,
  // Driving feel: brisk arcade handling with a little drift.
  accel: 620,
  brake: 900,
  reverseAccel: 380,
  maxSpeed: 540,
  sportsMaxSpeed: 660,
  maxReverse: 190,
  steer: 2.6,
  grip: 3.4,
  drag: 0.55,
  trafficSpeed: 150,
  policeSpeed: 590,
};

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, spread: 0.05, speed: 900, range: 520, mag: 12, reload: 0.9, price: 0, auto: false },
  smg: { name: 'SMG', damage: 18, rate: 0.09, spread: 0.11, speed: 950, range: 480, mag: 30, reload: 1.2, price: 800, auto: true },
  rifle: { name: 'Rifle', damage: 55, rate: 0.16, spread: 0.02, speed: 1300, range: 760, mag: 20, reload: 1.4, price: 1500, auto: true },
};

export const WANTED = {
  heatPerStar: 20,
  maxStars: 5,
  stealCar: 20,
  hitPed: 22,
  shoot: 12,
  killCop: 45,
  killGang: 6,
  // Seconds with no crime seen and no cop close before heat starts to fall.
  coolDelay: 6,
  coolRate: 5,
  bustRadius: 34,
  bustTime: 1.4,
};

export const POLICE = {
  maxCars: 6,
  spawnDistance: 900,
  despawnDistance: 1500,
  ramDamage: 14,
  shootRange: 420,
  shootDamage: 7,
  shootRate: 0.55,
};

export const MISSIONS = {
  startCash: 150,
};

export const SAVE_KEY = 'solmarina.save.v1';

export const PALETTE = {
  backdrop: '#0e2a3a',
  sea: '#2fa8c9',
  seaDeep: '#1d7ba0',
  sand: '#e8cf9e',
  sandDark: '#d9bd85',
  grass: '#79a95b',
  grassDark: '#63914a',
  road: '#3b3b44',
  roadEdge: '#2c2c33',
  lane: '#e8d44f',
  sidewalk: '#b3aa97',
  plaza: '#c9bda6',
  buildingShadow: 'rgba(0,0,0,0.28)',
  roofs: ['#c96f4a', '#e8dcc0', '#d98a7a', '#4a9a8c', '#d9a441', '#f2ede2', '#b45a6e', '#7a9cc9'],
  roofEdge: 'rgba(0,0,0,0.18)',
  palm: '#3f7d44',
  palmTrunk: '#8a6b4a',
  player: '#19c2e6',
  playerCar: '#ffcf3f',
  police: '#2f6fd6',
  policeLightR: '#ff3b30',
  policeLightB: '#3b82ff',
  gang: '#b03a3a',
  fare: '#37d67a',
  marker: '#ffd23f',
  text: '#f4efe4',
  muted: '#c9c2ae',
  panel: 'rgba(16, 22, 30, 0.86)',
  panelEdge: '#ffd23f',
  health: '#3ddc5a',
  armor: '#5aa8ff',
  star: '#ffd23f',
  starEmpty: 'rgba(255,255,255,0.25)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const DISTRICTS = [
  { name: 'North Hills', x0: 0, y0: 0, x1: 1000, y1: 380 },
  { name: 'Downtown', x0: 1000, y0: 380, x1: 2300, y1: 1650 },
  { name: 'Old Town', x0: 0, y0: 380, x1: 1000, y1: 2200 },
  { name: 'Portside', x0: 2300, y0: 0, x1: 3600, y1: 1000 },
  { name: 'Marina Bay', x0: 2300, y0: 1000, x1: 3600, y1: 2200 },
  { name: 'Beachfront', x0: 0, y0: 2200, x1: 3600, y1: 2600 },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Solmarina';
}
