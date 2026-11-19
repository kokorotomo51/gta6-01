// Side activities: taxi fares, the twenty sun coins hidden around the city,
// and the two shops — Solmarina Arms (weapons) and the Sunset Spray Shop
// (car repair and a clean wanted level).

import { WEAPONS } from './config.js';
import { spawnFarePed } from './pedestrians.js';

export function createActivitiesState(random) {
  const coins = [];
  // Twenty sun coins, scattered on sidewalks and the beach.
  const spots = [
    { x: 430, y: 560 }, { x: 1160, y: 300 }, { x: 1890, y: 900 }, { x: 2620, y: 500 },
    { x: 3250, y: 1200 }, { x: 700, y: 1710 }, { x: 1400, y: 2250 }, { x: 2200, y: 430 },
    { x: 2900, y: 1710 }, { x: 3400, y: 2000 }, { x: 300, y: 1200 }, { x: 1000, y: 2000 },
    { x: 1800, y: 2460 }, { x: 2400, y: 2450 }, { x: 1200, y: 2460 }, { x: 3200, y: 2460 },
    { x: 1890, y: 1300 }, { x: 2620, y: 2000 }, { x: 800, y: 800 }, { x: 3300, y: 800 },
  ];
  for (const s of spots) coins.push({ x: s.x, y: s.y, taken: false });
  return {
    coins,
    fareTimer: 6,
    activeFare: null, // the ped currently riding with the player
    fareTarget: null, // {x, y}
    shop: null, // 'guns' | 'spray' while the shop panel is open
  };
}

export function stepActivities(state, dt, random) {
  const a = state.activities;
  // A fare hails every so often while the player is driving.
  a.fareTimer -= dt;
  if (a.fareTimer <= 0) {
    a.fareTimer = 18 + random() * 14;
    let fares = 0;
    for (const ped of state.peds) if (ped.role === 'fare' && !ped.dead) fares += 1;
    if (fares < 3 && !a.activeFare) {
      const ped = spawnFarePed(state, random);
      if (ped) {
        state.peds.push(ped);
        state.events.message = 'Someone is hailing a cab — green $';
      }
    }
  }

  // Riding fare: the destination marker follows the fare's target.
  if (a.activeFare) {
    const target = a.fareTarget;
    const pos = state.player.car || state.player;
    if (target && Math.hypot(pos.x - target.x, pos.y - target.y) < 110) {
      const pay = a.activeFare.fare.pay;
      state.player.cash += pay;
      state.stats.fares += 1;
      state.events.message = `Fare complete! +$${pay}`;
      state.audio.pickup();
      if (state.mission.active) state.mission.fares += 1;
      a.activeFare.dead = true;
      a.activeFare = null;
      a.fareTarget = null;
    }
  }

  // Sun coins.
  const pos = state.player.car || state.player;
  for (const coin of a.coins) {
    if (coin.taken) continue;
    if (Math.hypot(pos.x - coin.x, pos.y - coin.y) < 34) {
      coin.taken = true;
      state.player.cash += 50;
      state.stats.collected += 1;
      state.events.message = `Sun coin! +$50 (${state.stats.collected}/20)`;
      state.audio.coin();
    }
  }
}

/** The player pressed E near a hailing fare. */
export function tryPickupFare(state) {
  const a = state.activities;
  if (a.activeFare) return false;
  const p = state.player;
  if (!p.car) return false; // fares only ride in a car
  for (const ped of state.peds) {
    if (ped.role !== 'fare' || ped.dead || ped.state !== 'wait') continue;
    if (Math.hypot(ped.x - p.x, ped.y - p.y) > 90) continue;
    const dest = ped.fare;
    const pay = 80 + Math.round(Math.hypot(dest.x - ped.x, dest.y - ped.y) / 12);
    dest.pay = Math.min(320, pay);
    a.activeFare = ped;
    a.fareTarget = { x: dest.x, y: dest.y };
    ped.state = 'riding';
    state.events.message = `Fare aboard — take them to the marker ($${dest.pay})`;
    state.audio.pickup();
    return true;
  }
  return false;
}

/** The player pressed E near a shop. Returns 'guns' | 'spray' | null. */
export function shopNear(state) {
  const p = state.player;
  const pos = p.car || p;
  const gun = state.city.landmarks.gunShop;
  const spray = state.city.landmarks.sprayShop;
  if (Math.hypot(pos.x - gun.x, pos.y - gun.y) < 150) return 'guns';
  if (Math.hypot(pos.x - spray.x, pos.y - spray.y) < 150) return 'spray';
  return null;
}

export function buyWeapon(state, key) {
  const p = state.player;
  const w = WEAPONS[key];
  if (!w || w.price === 0) return;
  if (p.weapons.includes(key)) {
    // Top up ammo instead.
    const cost = 120;
    if (p.cash < cost) { state.events.message = 'Not enough cash for ammo'; return; }
    p.cash -= cost;
    p.ammo[key] += w.mag * 2;
    state.events.message = `${w.name} ammo +${w.mag * 2} (-$${cost})`;
    state.audio.pickup();
    return;
  }
  if (p.cash < w.price) {
    state.events.message = `Need $${w.price} for the ${w.name}`;
    return;
  }
  p.cash -= w.price;
  p.weapons.push(key);
  p.ammo[key] = w.mag * 3;
  p.mag[key] = w.mag;
  p.weapon = key;
  state.events.message = `Bought the ${w.name} (-$${w.price})`;
  state.audio.pickup();
}

export function buyArmor(state) {
  const p = state.player;
  if (p.armor >= 100) { state.events.message = 'Armor already full'; return; }
  if (p.cash < 200) { state.events.message = 'Need $200 for armor'; return; }
  p.cash -= 200;
  p.armor = 100;
  state.events.message = 'Body armor fitted (-$200)';
  state.audio.pickup();
}

export function sprayService(state, kind) {
  const p = state.player;
  if (kind === 'repair') {
    if (!p.car) { state.events.message = 'No car to repair'; return; }
    if (p.car.hp >= 100) { state.events.message = 'Car is already in top shape'; return; }
    if (p.cash < 100) { state.events.message = 'Need $100 for repairs'; return; }
    p.cash -= 100;
    p.car.hp = 100;
    state.events.message = 'Car repaired (-$100)';
    state.audio.pickup();
    return;
  }
  if (kind === 'clean') {
    if (state.wanted.stars === 0) { state.events.message = 'No heat to lose'; return; }
    if (p.cash < 300) { state.events.message = 'Need $300 for a new paint job'; return; }
    p.cash -= 300;
    state.wanted.heat = 0;
    state.wanted.stars = 0;
    for (const car of state.cars) if (car.driver === 'police') car.driver = 'traffic';
    for (const ped of state.peds) if (ped.role === 'cop') ped.dead = true;
    state.roadblock = null;
    state.events.message = 'New paint, new plates — the heat is off (-$300)';
    state.audio.pickup();
  }
}
