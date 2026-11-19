// Save and load: one slot in localStorage. Progress, cash, weapons, the
// mission the player is on, and where they were standing.

import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      version: 1,
      cash: p.cash,
      health: p.health,
      armor: p.armor,
      weapons: p.weapons,
      weapon: p.weapon,
      ammo: p.ammo,
      missionIndex: state.mission.index,
      completedCount: state.mission.completedCount,
      collected: state.stats.collected,
      fares: state.stats.fares,
      kills: state.stats.kills,
      x: p.x,
      y: p.y,
      coins: state.activities.coins.map((c) => (c.taken ? 1 : 0)).join(''),
      clock: state.clock,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore.
  }
}

export function hasSave() {
  return loadGame() !== null;
}

/** Apply a loaded save to a fresh world state. */
export function applySave(state, data) {
  const p = state.player;
  p.cash = data.cash;
  p.health = data.health;
  p.armor = data.armor;
  p.weapons = [...data.weapons];
  p.weapon = data.weapon;
  p.ammo = { ...data.ammo };
  p.x = data.x;
  p.y = data.y;
  state.mission.index = data.missionIndex;
  state.mission.completedCount = data.completedCount || 0;
  state.mission.pending = true;
  state.stats.collected = data.collected || 0;
  state.stats.fares = data.fares || 0;
  state.stats.kills = data.kills || 0;
  state.clock = data.clock || 8 * 60;
  if (data.coins) {
    for (let i = 0; i < data.coins.length && i < state.activities.coins.length; i += 1) {
      state.activities.coins[i].taken = data.coins[i] === '1';
    }
  }
}
