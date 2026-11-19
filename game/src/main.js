// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play,
// paused, game over, and the shop panels. ?shot=street|drive|chase|mission
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createWorld, interact, respawn, step } from './world.js';
import { startReload } from './player.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_NEXT_MISSION, ACTION_PAUSE, ACTION_WEAPON, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { startMission } from './missions.js';
import { buyArmor, buyWeapon, sprayService } from './activities.js';
import { applySave, hasSave, loadGame, saveGame } from './save.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const minimap = document.getElementById('minimap');
const status = document.getElementById('status');
const renderer = createRenderer(canvas, minimap);

// Any uncaught error is drawn onto the screen in shot mode, so a broken build
// shows up in its own screenshots instead of failing silently.
window.__shotErrors = [];
window.addEventListener('error', (event) => {
  window.__shotErrors.push(String(event.message || event.error));
});

function runShot(name) {
  const staged = stageShot(name, seed);
  const state = staged.state;
  let painted = 0;
  function paint() {
    renderer.draw(state, staged.screen, false, null);
    if (window.__shotErrors.length > 0) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ff0000';
      ctx.font = '20px monospace';
      ctx.fillText('ERROR: ' + window.__shotErrors[0], 20, 40);
    }
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let world = createWorld(seed);
  let screen = SCREEN_TITLE;
  let saveAvailable = hasSave();
  let accumulator = 0;
  let last = performance.now();

  input.onMuteKey(() => {
    world.audio.setMuted(!world.audio.isMuted());
    world.events.message = world.audio.isMuted() ? 'Sound off' : 'Sound on';
  });
  input.onReloadKey(() => {
    if (screen === SCREEN_PLAY && !world.player.car) startReload(world);
  });

  // Shop keys: 1/2/3 buy while a shop panel is open.
  window.addEventListener('keydown', (event) => {
    const shop = world.activities.shop;
    if (!shop || screen !== SCREEN_PLAY) return;
    if (event.code === 'Digit1') {
      if (shop === 'guns') buyWeapon(world, 'smg');
      else sprayService(world, 'repair');
    } else if (event.code === 'Digit2') {
      if (shop === 'guns') buyWeapon(world, 'rifle');
      else sprayService(world, 'clean');
    } else if (event.code === 'Digit3') {
      if (shop === 'guns') buyArmor(world);
    }
  });

  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    world = createWorld(seed);
    screen = SCREEN_PLAY;
    startMission(world, 0);
    announce('Solmarina. Mission 1: First Wheels.');
  }

  function continueGame() {
    const data = loadGame();
    if (!data) { startNewGame(); return; }
    world = createWorld(seed);
    applySave(world, data);
    screen = SCREEN_PLAY;
    world.events.message = 'Welcome back to Solmarina — press N for your next mission';
    announce('Continued your saved game.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    saveGame(world);
    announce(world.overReason === 'busted' ? 'Busted.' : 'Wasted.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_INTERACT && screen === SCREEN_PLAY) {
      if (world.activities.shop) world.activities.shop = null;
      else interact(world);
      return;
    }
    if (actions & ACTION_NEXT_MISSION && screen === SCREEN_PLAY) {
      const m = world.mission;
      if (m.failed) {
        m.failed = false;
        startMission(world, m.index);
      } else if (m.pending && !m.active) {
        m.pending = false;
        startMission(world, m.index);
      }
      return;
    }
    if (actions & ACTION_WEAPON && screen === SCREEN_PLAY && !world.player.car) {
      const p = world.player;
      const i = p.weapons.indexOf(p.weapon);
      p.weapon = p.weapons[(i + 1) % p.weapons.length];
      world.events.message = `Weapon: ${p.weapon}`;
      return;
    }
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) { startNewGame(); return; }
      if (screen === SCREEN_OVER) {
        respawn(world);
        screen = SCREEN_PLAY;
        announce('Back on the streets.');
        return;
      }
      if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); return; }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        if (world.activities.shop) { world.activities.shop = null; return; }
        screen = SCREEN_PAUSED;
        saveGame(world);
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step(world, STEP, input);
        accumulator -= STEP;
        if (world.over) { endGame(); break; }
      }
      // Keep the mouse aim in world coordinates for shooting.
      const v = renderer.view;
      const cam = world.camera;
      input.setAim({ x: cam.x - 640, y: cam.y - 400 }, v.scale, v.x, v.y);
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, saveAvailable, null);
  }

  // Continue with C on the title screen.
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE && event.code === 'KeyC' && saveAvailable) continueGame();
  });

  // Leaving the tab pauses a running game rather than letting the city run on.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(world);
      announce('Paused.');
    }
  });

  announce('Solmarina. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
