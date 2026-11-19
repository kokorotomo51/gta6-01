// Missions and the story of Solmarina. Rio, new in town, works for Mara Voss,
// who runs the garage and the jobs nobody else will touch. Five missions take
// Rio from a stolen sedan to the Golden Gull — and the whole city notices.

import { addHeat } from './police.js';

export const MISSION_LIST = [
  {
    id: 'first-wheels',
    title: '1 — First Wheels',
    reward: 300,
    brief: [
      'MARA: Rio. You want work in Solmarina, you need wheels.',
      'MARA: Take any car on the street — press E next to one — and bring it to my garage.',
    ],
    steps: [
      { type: 'steal', text: 'Steal a car (walk up to one, press E)' },
      { type: 'goto', at: 'garage', text: 'Drive to Mara\'s Garage' },
    ],
  },
  {
    id: 'package-run',
    title: '2 — Package Run',
    reward: 500,
    brief: [
      'MARA: A package is waiting at the Portside Docks. Pick it up, bring it to Old Town Square.',
      'MARA: Ninety seconds. The docks are watched, so do not dawdle.',
    ],
    steps: [
      { type: 'goto', at: 'docks', text: 'Go to the Portside Docks', time: 90 },
      { type: 'pickup', text: 'Pick up the package (press E)' },
      { type: 'goto', at: 'oldTown', text: 'Deliver to Old Town Square', time: 90 },
    ],
  },
  {
    id: 'fare-game',
    title: '3 — Fare Game',
    reward: 600,
    brief: [
      'MARA: The garage is quiet. Earn your keep driving a cab — pick up three fares.',
      'MARA: Look for the green $ over their heads. Get them where they are going, fast.',
    ],
    steps: [
      { type: 'taxi', count: 3, text: 'Pick up 3 fares (0/3)' },
    ],
  },
  {
    id: 'dockside-heat',
    title: '4 — Dockside Heat',
    reward: 900,
    brief: [
      'MARA: The Red Tide gang hit our warehouse at the docks. Go and take it back.',
      'MARA: Six of them, armed. Then lose the cops and come home.',
    ],
    steps: [
      { type: 'goto', at: 'docks', text: 'Go to the Portside Docks' },
      { type: 'kill', count: 6, text: 'Clear the docks (0/6)' },
      { type: 'escape', text: 'Lose the wanted level' },
    ],
  },
  {
    id: 'golden-gull',
    title: '5 — The Golden Gull',
    reward: 1500,
    brief: [
      'MARA: The Golden Gull — a one-off gold sports car — sits in the casino lot at Marina Bay.',
      'MARA: Steal it, outrun everything the city throws at you, and bring it to the hideout.',
    ],
    steps: [
      { type: 'goto', at: 'casino', text: 'Go to the Golden Gull Casino' },
      { type: 'stealGolden', text: 'Steal the golden sports car (press E)' },
      { type: 'goto', at: 'hideout', text: 'Escape to the Hideout — the whole city is after you' },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0, // which mission of MISSION_LIST
    step: 0,
    active: false,
    done: false,
    timer: 0,
    kills: 0,
    fares: 0,
    marker: null, // {x, y, label}
    dialogue: [], // lines waiting to be shown
    dialogueTimer: 0,
    currentLine: '',
    packageCarried: false,
    goldenStolen: false,
    gangSpawned: false,
    completedCount: 0,
  };
}

export function currentMission(state) {
  const m = state.mission;
  if (m.index >= MISSION_LIST.length) return null;
  return MISSION_LIST[m.index];
}

export function currentStep(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.mission.step] || null;
}

export function missionTitle(state) {
  const mission = currentMission(state);
  return mission ? mission.title : 'Solmarina — Free Roam';
}

export function objectiveText(state) {
  const step = currentStep(state);
  if (!state.mission.active) {
    if (state.mission.pending) return 'Press N for your next mission';
    if (state.mission.index >= MISSION_LIST.length) return 'All missions complete — Solmarina is yours. Free roam!';
    return 'Free roam — explore Solmarina';
  }
  if (!step) return 'All missions complete — Solmarina is yours. Free roam!';
  let text = step.text;
  if (step.type === 'taxi') text = `Pick up ${step.count} fares (${state.mission.fares}/${step.count})`;
  if (step.type === 'kill') text = `Clear the docks (${state.mission.kills}/${step.count})`;
  return text;
}

function say(state, lines) {
  state.mission.dialogue = [...lines];
  state.mission.dialogueTimer = 0;
  advanceDialogue(state);
}

function advanceDialogue(state) {
  const m = state.mission;
  if (m.dialogue.length === 0) {
    m.currentLine = '';
    return;
  }
  m.currentLine = m.dialogue.shift();
  m.dialogueTimer = 4.5;
}

function setMarker(state, landmarkKey) {
  const lm = state.city.landmarks[landmarkKey];
  if (lm) state.mission.marker = { x: lm.x, y: lm.y, label: lm.name };
  else state.mission.marker = null;
}

export function startMission(state, index) {
  const m = state.mission;
  m.index = index;
  m.step = 0;
  m.active = true;
  m.done = false;
  m.timer = 0;
  m.kills = 0;
  m.fares = 0;
  m.packageCarried = false;
  m.goldenStolen = false;
  m.gangSpawned = false;
  const mission = MISSION_LIST[index];
  say(state, mission.brief);
  applyStep(state);
  state.events.message = `Mission started: ${mission.title}`;
  state.audio.missionStart();
}

export function applyStep(state) {
  const m = state.mission;
  const step = currentStep(state);
  if (!step) return;
  if (step.type === 'goto') setMarker(state, step.at);
  else if (step.type === 'pickup') setMarker(state, 'docks');
  else if (step.type === 'stealGolden') setMarker(state, 'goldenLot');
  else if (step.type === 'taxi' || step.type === 'kill' || step.type === 'escape') state.mission.marker = null;
  if (step.time) m.timer = step.time;
  if (step.type === 'kill' && !m.gangSpawned) {
    m.gangSpawned = true;
    state.events.spawnGang = true;
  }
}

export function completeMission(state) {
  const m = state.mission;
  const mission = currentMission(state);
  if (!mission) return;
  state.player.cash += mission.reward;
  m.completedCount += 1;
  m.active = false;
  m.done = true;
  state.events.message = `Mission complete! +$${mission.reward}`;
  state.audio.missionComplete();
  say(state, [`MARA: Clean work, Rio. $${mission.reward} is yours.`, 'MARA: There is more where that came from.']);
  m.index += 1;
  m.step = 0;
  if (m.index < MISSION_LIST.length) {
    // The next mission starts when the player walks into the garage, or with
    // the N key — world.js offers it; here we just leave it pending.
    m.pending = true;
  } else {
    state.events.message = 'All missions complete — Solmarina is yours!';
  }
}

export function failMission(state, reason) {
  const m = state.mission;
  m.active = false;
  m.step = 0;
  m.timer = 0;
  m.kills = 0;
  m.fares = 0;
  m.packageCarried = false;
  m.goldenStolen = false;
  m.gangSpawned = false;
  m.marker = null;
  state.events.message = `Mission failed: ${reason} — press N to retry`;
  state.audio.missionFail();
  m.failed = true;
}

/** Advance the mission state machine one step. Called every frame from world.js. */
export function stepMissions(state, dt) {
  const m = state.mission;
  // Dialogue lines rotate on their timer.
  if (m.dialogueTimer > 0) {
    m.dialogueTimer -= dt;
    if (m.dialogueTimer <= 0) advanceDialogue(state);
  }
  if (!m.active) return;
  const mission = currentMission(state);
  if (!mission) return;
  const step = currentStep(state);
  if (!step) { completeMission(state); return; }

  // Timed steps.
  if (step.time && m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(state, 'out of time');
      return;
    }
  }

  const p = state.player;
  const pos = p.car || p;

  if (step.type === 'steal') {
    if (p.car) advanceStep(state);
    return;
  }
  if (step.type === 'stealGolden') {
    if (m.goldenStolen) advanceStep(state);
    return;
  }
  if (step.type === 'goto') {
    const lm = state.city.landmarks[step.at];
    if (lm && Math.hypot(pos.x - lm.x, pos.y - lm.y) < 130) {
      if (step.at === 'casino' && mission.id === 'golden-gull') {
        state.events.spawnGolden = true;
      }
      advanceStep(state);
    }
    return;
  }
  if (step.type === 'pickup') {
    if (m.packageCarried) advanceStep(state);
    return;
  }
  if (step.type === 'taxi') {
    if (m.fares >= step.count) advanceStep(state);
    return;
  }
  if (step.type === 'kill') {
    if (m.kills >= step.count) advanceStep(state);
    return;
  }
  if (step.type === 'escape') {
    if (state.wanted.stars === 0) advanceStep(state);
    return;
  }
}

export function advanceStep(state) {
  const m = state.mission;
  const mission = currentMission(state);
  if (!mission) return;
  m.step += 1;
  if (m.step >= mission.steps.length) {
    completeMission(state);
    return;
  }
  applyStep(state);
  const step = currentStep(state);
  if (step) state.events.message = `Objective: ${step.text}`;
}

/** The player pressed E on the package spot at the docks. */
export function tryPickupPackage(state) {
  const m = state.mission;
  const step = currentStep(state);
  if (!m.active || !step || step.type !== 'pickup') return false;
  const lm = state.city.landmarks.docks;
  const pos = state.player.car || state.player;
  if (Math.hypot(pos.x - lm.x, pos.y - lm.y) > 160) return false;
  m.packageCarried = true;
  state.events.message = 'Package picked up — deliver it to Old Town Square';
  state.audio.pickup();
  return true;
}

/** Called when the player steals the golden car (mission 5). */
export function onGoldenStolen(state) {
  const m = state.mission;
  m.goldenStolen = true;
  addHeat(state, 80, 'stole the Golden Gull');
  state.events.message = 'The Golden Gull is yours — RUN!';
}

/** Called when a gang member dies during mission 4. */
export function onGangKilled(state) {
  const m = state.mission;
  if (!m.active) return;
  const step = currentStep(state);
  if (step && step.type === 'kill') {
    m.kills += 1;
    state.stats.kills += 1;
  }
}
