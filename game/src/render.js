// Drawing only: the city, the cars, the people, the effects, the HUD with its
// minimap, and the menu screens. The world is drawn in camera space (a fixed
// 1280x800 window of the city); the HUD is drawn in screen space on top.
// Nothing here changes the game — it paints what the state holds.

import { CITY, FONT, PALETTE, WEAPONS, WORLD, districtAt } from './config.js';
import { wantedStars } from './police.js';
import { currentMission, missionTitle, objectiveText } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const VIEW = { width: 1280, height: 800 };

function fmtCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

function fmtClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function createRenderer(canvas, minimapCanvas) {
  const ctx = canvas.getContext('2d');
  const mapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w;
    canvas.height = h;
    view.scale = Math.min(w / VIEW.width, h / VIEW.height);
    view.x = (w - VIEW.width * view.scale) / 2;
    view.y = (h - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = size + (weight || '');
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`.trim());
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function bar(x, y, w, h, ratio, color, bg) {
    ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * Math.max(0, Math.min(1, ratio))), h - 2);
  }

  function drawGround(state) {
    const city = state.city;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // Sand, then sea along the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, city.sandTop, WORLD.width, WORLD.height - city.sandTop);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(0, city.seaTop, WORLD.width, WORLD.height - city.seaTop);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let x = 0; x < WORLD.width; x += 260) {
      ctx.fillRect(x + 40, city.seaTop + 26, 150, 5);
      ctx.fillRect(x + 130, city.seaTop + 52, 110, 4);
    }
    // Block interiors: alternating lawn and paved lots so the city reads as
    // built-up, not empty grass. Downtown blocks are paved, the park stays green.
    for (const block of city.blocks) {
      if (block === city.park) continue;
      if (block.y0 > city.sandTop) continue;
      const downtown = block.col === 2 && block.row <= 1;
      ctx.fillStyle = block === city.plaza ? PALETTE.plaza : downtown ? '#9aa08a' : ((block.col + block.row) % 2 === 0 ? '#6f9e52' : '#79a95b');
      ctx.fillRect(block.x0, block.y0, block.x1 - block.x0, block.y1 - block.y0);
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of city.roadsV) ctx.fillRect(rx - city.roadWidth / 2, 0, city.roadWidth, WORLD.height);
    for (const ry of city.roadsH) ctx.fillRect(0, ry - city.roadWidth / 2, WORLD.width, city.roadWidth);
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of city.roadsV) {
      ctx.fillRect(rx - city.roadWidth / 2 - city.sidewalk, 0, city.sidewalk, WORLD.height);
      ctx.fillRect(rx + city.roadWidth / 2, 0, city.sidewalk, WORLD.height);
    }
    for (const ry of city.roadsH) {
      ctx.fillRect(0, ry - city.roadWidth / 2 - city.sidewalk, WORLD.width, city.sidewalk);
      ctx.fillRect(0, ry + city.roadWidth / 2, WORLD.width, city.sidewalk);
    }
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const rx of city.roadsV) {
      for (let y = 20; y < WORLD.height; y += 56) ctx.fillRect(rx - 2, y, 4, 26);
    }
    for (const ry of city.roadsH) {
      for (let x = 20; x < WORLD.width; x += 56) ctx.fillRect(x, ry - 2, 26, 4);
    }
    // Crosswalks at every junction.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of city.roadsV) {
      for (const ry of city.roadsH) {
        for (let i = 0; i < 5; i += 1) {
          ctx.fillRect(rx - 44 + i * 20, ry - city.roadWidth / 2 + 4, 10, 6);
          ctx.fillRect(rx - 44 + i * 20, ry + city.roadWidth / 2 - 10, 10, 6);
        }
      }
    }
  }

  function drawProps(state) {
    const city = state.city;
    for (const prop of city.props) {
      if (prop.kind === 'pond') {
        ctx.fillStyle = PALETTE.sea;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, prop.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.seaDeep;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, prop.r - 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (prop.kind === 'fountain') {
        ctx.fillStyle = PALETTE.plaza;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, prop.r + 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.sea;
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, prop.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(prop.x, prop.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Trees and palms.
    for (const t of city.trees) {
      ctx.fillStyle = PALETTE.palmTrunk;
      ctx.fillRect(t.x - 2, t.y - 2, 4, 4);
      ctx.fillStyle = PALETTE.palm;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const palm of city.palms) {
      ctx.fillStyle = PALETTE.palmTrunk;
      ctx.fillRect(palm.x - 2, palm.y - 2, 4, 4);
      ctx.fillStyle = '#4a9a5c';
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(palm.x + Math.cos(a) * palm.r * 0.7, palm.y + Math.sin(a) * palm.r * 0.7, palm.r * 0.75, palm.r * 0.3, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawBuildings(state) {
    for (const b of state.city.buildings) {
      // Fake height: the roof is offset up-left from its shadow.
      ctx.fillStyle = PALETTE.buildingShadow;
      ctx.fillRect(b.x0 + 4, b.y0 + 6, b.x1 - b.x0, b.y1 - b.y0);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x0, b.y0 - b.height * 0.4, b.x1 - b.x0, (b.y1 - b.y0) + b.height * 0.4);
      ctx.fillStyle = PALETTE.roofEdge;
      ctx.fillRect(b.x0, b.y0 - b.height * 0.4, b.x1 - b.x0, 4);
      ctx.fillRect(b.x0, b.y0 - b.height * 0.4, 4, (b.y1 - b.y0) + b.height * 0.4);
      // Rooftop details: AC boxes and skylights on tall buildings.
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(b.x0 + 10, b.y0 - b.height * 0.4 + 10, 14, 10);
        ctx.fillRect(b.x1 - 26, b.y0 - b.height * 0.4 + 12, 12, 12);
      }
      if (b.windows) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        const cols = Math.max(1, Math.floor((b.x1 - b.x0) / 26));
        for (let i = 0; i < cols; i += 1) {
          ctx.fillRect(b.x0 + 8 + i * 26, b.y0 + 8, 10, 8);
        }
      }
    }
  }

  function drawCarShape(car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-26 + 3, -11 + 4, 54, 26);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-27, -13, 54, 26, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    ctx.beginPath();
    ctx.roundRect(-6, -11, 18, 22, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,240,0.5)';
    ctx.fillRect(10, -10, 4, 20);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(25, -11, 3, 5);
    ctx.fillRect(25, 6, 3, 5);
    // Police light bar, flashing.
    if (car.driver === 'police' || car.driver === 'roadblock') {
      const on = Math.floor(time * 6) % 2 === 0;
      ctx.fillStyle = on ? PALETTE.policeLightR : PALETTE.policeLightB;
      ctx.fillRect(-4, -13, 8, 5);
      ctx.fillStyle = on ? PALETTE.policeLightB : PALETTE.policeLightR;
      ctx.fillRect(-4, 8, 8, 5);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 4);
    }
    // The golden car gets a star.
    ctx.restore();
    if (car.kind === 'sports' && car.color === '#ffd23f') {
      ctx.save();
      ctx.translate(car.x, car.y - 24);
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('★ GOLDEN GULL ★', 0, 0);
      ctx.restore();
    }
  }

  function drawPed(ped, time) {
    if (ped.dead) return;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: a circle with a direction nose.
    ctx.fillStyle = ped.role === 'cop' ? '#2f6fd6' : ped.role === 'gang' ? '#b03a3a' : ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 5, Math.sin(ped.angle) * 5, 4, 0, Math.PI * 2);
    ctx.fill();
    if (ped.role === 'fare' && ped.state === 'wait') {
      // Hailing: a bobbing green $.
      const bob = Math.sin(time * 4 + ped.id) * 3;
      ctx.fillStyle = PALETTE.fare;
      ctx.font = 'bold 18px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, -16 + bob);
    }
    if (ped.role === 'gang' || ped.role === 'cop') {
      ctx.fillStyle = '#222';
      ctx.fillRect(Math.cos(ped.angle) * 10 - 2, Math.sin(ped.angle) * 10 - 2, 8, 4);
    }
    ctx.restore();
  }

  function drawPlayer(state, time) {
    const p = state.player;
    if (p.dead || p.car) return;
    if (p.invulnerable > 0 && Math.floor(time * 10) % 2 === 0) return; // blink while hurt
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 4, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    // Facing: a little gun barrel when armed.
    ctx.strokeStyle = '#1a2a33';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.angle) * 8, Math.sin(p.angle) * 8);
    ctx.lineTo(Math.cos(p.angle) * 20, Math.sin(p.angle) * 20);
    ctx.stroke();
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBullets(state) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawMarker(state, time) {
    const marker = state.mission.marker || (state.activities.fareTarget
      ? { x: state.activities.fareTarget.x, y: state.activities.fareTarget.y, label: 'Fare' } : null);
    if (!marker) return;
    const pulse = 1 + Math.sin(time * 5) * 0.15;
    // A beacon column so the target is visible from across the city.
    ctx.fillStyle = 'rgba(255,210,63,0.16)';
    ctx.fillRect(marker.x - 6, marker.y - 320, 12, 320);
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.marker;
    const s = 16 * pulse;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.fillStyle = PALETTE.marker;
    ctx.font = 'bold 15px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, marker.x, marker.y - 26);
  }

  function drawCoins(state, time) {
    for (const coin of state.activities.coins) {
      if (coin.taken) continue;
      const bob = Math.sin(time * 3 + coin.x) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y + bob, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('$', coin.x, coin.y + bob + 4);
    }
  }

  function drawMinimap(state) {
    if (!mapCtx) return;
    const W = 200;
    const H = 150;
    const sx = W / WORLD.width;
    const sy = H / WORLD.height;
    mapCtx.fillStyle = '#1d2b33';
    mapCtx.fillRect(0, 0, W, H);
    mapCtx.fillStyle = '#2fa8c9';
    mapCtx.fillRect(0, state.city.seaTop * sy, W, H - state.city.seaTop * sy);
    mapCtx.strokeStyle = '#8b93a3';
    mapCtx.lineWidth = 2;
    for (const rx of state.city.roadsV) {
      mapCtx.beginPath();
      mapCtx.moveTo(rx * sx, 0);
      mapCtx.lineTo(rx * sx, H);
      mapCtx.stroke();
    }
    for (const ry of state.city.roadsH) {
      mapCtx.beginPath();
      mapCtx.moveTo(0, ry * sy);
      mapCtx.lineTo(W, ry * sy);
      mapCtx.stroke();
    }
    // Mission / fare marker.
    const marker = state.mission.marker || (state.activities.fareTarget
      ? { x: state.activities.fareTarget.x, y: state.activities.fareTarget.y } : null);
    if (marker) {
      mapCtx.fillStyle = '#ffd23f';
      mapCtx.beginPath();
      mapCtx.arc(marker.x * sx, marker.y * sy, 5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Cops in blue, cars in white, fares in green.
    for (const car of state.cars) {
      if (car.dead) continue;
      mapCtx.fillStyle = car.driver === 'police' ? '#3b82ff' : 'rgba(255,255,255,0.85)';
      mapCtx.fillRect(car.x * sx - 1.5, car.y * sy - 1.5, 3, 3);
    }
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (ped.role === 'fare' && ped.state === 'wait') {
        mapCtx.fillStyle = '#37d67a';
        mapCtx.fillRect(ped.x * sx - 2, ped.y * sy - 2, 4, 4);
      } else if (ped.role === 'cop') {
        mapCtx.fillStyle = '#3b82ff';
        mapCtx.fillRect(ped.x * sx - 1.5, ped.y * sy - 1.5, 3, 3);
      }
    }
    // The player: a yellow arrow.
    const p = state.player;
    const px = p.x * sx;
    const py = p.y * sy;
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(p.angle);
    mapCtx.fillStyle = '#ffd23f';
    mapCtx.beginPath();
    mapCtx.moveTo(7, 0);
    mapCtx.lineTo(-5, -4);
    mapCtx.lineTo(-5, 4);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  function drawHud(state, screen) {
    const p = state.player;
    const stars = wantedStars(state);
    // Top-left cluster: health, armor, cash, weapon.
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    ctx.fillRect(14, 12, 300, 96);
    bar(24, 24, 200, 14, p.health / 100, PALETTE.health);
    text('HP', 230, 36, 13, PALETTE.text, 'left', 'bold');
    bar(24, 44, 200, 10, p.armor / 100, PALETTE.armor);
    text('ARMOR', 230, 53, 13, PALETTE.text, 'left', 'bold');
    text(fmtCash(p.cash), 24, 82, 24, '#7dff8a', 'left', 'bold');
    const w = WEAPONS[p.weapon];
    const ammoText = p.ammo[p.weapon] === Infinity ? '∞' : `${p.mag[p.weapon]} / ${p.ammo[p.weapon]}`;
    text(`${w.name}  ${ammoText}`, 24, 100, 15, PALETTE.text, 'left');
    // Top-right: wanted stars + clock + district, on a dark panel so the
    // text stays readable over bright roofs and sand.
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    ctx.fillRect(VIEW.width - 268, 12, 254, 84);
    let starText = '';
    for (let i = 0; i < 5; i += 1) starText += i < stars ? '★' : '☆';
    text(starText, VIEW.width - 28, 40, 26, stars > 0 ? PALETTE.star : PALETTE.starEmpty, 'right', 'bold');
    text(fmtClock(state.clock), VIEW.width - 28, 66, 18, PALETTE.text, 'right');
    text(districtAt(p.x, p.y), VIEW.width - 28, 88, 14, PALETTE.muted, 'right');
    // Objective line under the top bar.
    text('◆ ' + objectiveText(state), 24, 132, 17, PALETTE.marker, 'left', 'bold');
    if (state.mission.timer > 0 && state.mission.active) {
      text(`⏱ ${Math.ceil(state.mission.timer)}s`, 24, 156, 17, '#ff8a7a', 'left', 'bold');
    }
    // Dialogue subtitle at the bottom.
    if (state.mission.currentLine) {
      ctx.fillStyle = 'rgba(10,14,20,0.72)';
      const line = state.mission.currentLine;
      ctx.font = `16px ${FONT}`;
      const lw = ctx.measureText(line).width;
      ctx.fillRect((VIEW.width - lw) / 2 - 16, VIEW.height - 64, lw + 32, 34);
      text(line, VIEW.width / 2, VIEW.height - 41, 16, PALETTE.text, 'center');
    }
    // Toast message.
    if (state.events.message) {
      ctx.font = `bold 17px ${FONT}`;
      const lw = ctx.measureText(state.events.message).width;
      ctx.fillStyle = 'rgba(10,14,20,0.72)';
      ctx.fillRect((VIEW.width - lw) / 2 - 14, 168, lw + 28, 32);
      text(state.events.message, VIEW.width / 2, 191, 17, '#ffe9a8', 'center', 'bold');
    }
    // Context hint: what E does right now.
    if (!p.car && screen === SCREEN_PLAY) {
      text('E — enter car · Q — weapon · R — reload · M — mute · P — pause', 24, VIEW.height - 18, 13, PALETTE.muted, 'left');
    } else if (p.car && screen === SCREEN_PLAY) {
      const speedKmh = Math.round(Math.abs(p.car.speed) * 0.24);
      text(`${speedKmh} km/h   E — leave car · P — pause`, 24, VIEW.height - 18, 13, PALETTE.muted, 'left');
      if (p.car.hp < 100) {
        bar(24, VIEW.height - 44, 160, 10, p.car.hp / 100, '#ff8a3c');
        text('CAR', 190, VIEW.height - 35, 12, PALETTE.text, 'left', 'bold');
      }
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 30;
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = accent || PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    text(title, VIEW.width / 2, y + 64, 44, PALETTE.text, 'center', 'bold');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW.width / 2, y + 112 + i * 30, 18, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 26, 18, PALETTE.marker, 'center', 'bold');
  }

  function drawTitle(state, hasSave, stats) {
    drawPanel('SOLMARINA', [
      'A sun-soaked open-world crime game in the spirit of GTA 6.',
      'Steal cars, outrun the police, run Mara\'s jobs — and take the city.',
      'WASD move / drive · Mouse aim · Click shoot · E enter car / interact',
      'Q switch weapon · R reload · N next mission · M mute · P pause',
      hasSave ? 'A saved game is waiting for you.' : 'No saved game yet — a new story begins.',
    ], hasSave ? 'SPACE — New game · C — Continue' : 'Press SPACE or click to start', '#ffd23f');
    text('Rio arrives in Solmarina with $150 and nothing to lose.', VIEW.width / 2, VIEW.height - 96, 16, PALETTE.muted, 'center');
  }

  function drawShop(state) {
    const shop = state.activities.shop;
    if (!shop) return;
    const p = state.player;
    if (shop === 'guns') {
      drawPanel('SOLMARINA ARMS', [
        `Cash: ${fmtCash(p.cash)} — your weapons: ${p.weapons.map((k) => WEAPONS[k].name).join(', ')}`,
        '1 — SMG $800 (fast, close range) · 2 — Rifle $1500 (hard, long range)',
        '3 — Body armor $200 · Ammo top-up $120 (when you own the gun)',
        'Press 1 / 2 / 3, or E to walk away.',
      ], 'E — leave the shop', '#5aa8ff');
    } else {
      drawPanel('SUNSET SPRAY SHOP', [
        `Cash: ${fmtCash(p.cash)}`,
        '1 — Repair car $100 · 2 — New paint job $300 (clears your wanted level)',
        'Press 1 / 2, or E to walk away.',
      ], 'E — leave the shop', '#ff8a3c');
    }
  }

  /** Paint one frame. `screen` is one of SCREEN_TITLE/PLAY/PAUSED/OVER. */
  function draw(state, screen, hasSave, stats) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cam = state.camera;
    const ox = view.x + VIEW.width / 2 * view.scale - cam.x * view.scale;
    const oy = view.y + VIEW.height / 2 * view.scale - cam.y * view.scale;
    ctx.setTransform(view.scale, 0, 0, view.scale, ox, oy);
    drawGround(state);
    drawProps(state);
    drawBuildings(state);
    drawCoins(state, state.time);
    drawMarker(state, state.time);
    for (const car of state.cars) if (!car.dead) drawCarShape(car, state.time);
    for (const ped of state.peds) drawPed(ped, state.time);
    drawPlayer(state, state.time);
    drawBullets(state);
    // Screen space from here.
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawMinimap(state);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, hasSave, stats);
      return;
    }
    drawHud(state, screen);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', [
        `${missionTitle(state)} — ${objectiveText(state)}`,
        `Cash ${fmtCash(state.player.cash)} · Missions done ${state.mission.completedCount}/5`,
        'Progress saves automatically every 30 seconds.',
      ], 'Press P or click to keep playing');
    } else if (screen === SCREEN_OVER) {
      const reason = state.overReason === 'busted' ? 'BUSTED' : 'WASTED';
      drawPanel(reason, [
        state.overReason === 'busted'
          ? 'The Solmarina PD caught up with you.'
          : 'You went down in the streets of Solmarina.',
        `You kept ${fmtCash(state.player.cash)} — the hospital takes 10%.`,
        'Your mission progress is saved. Get back out there.',
      ], 'Press SPACE to respawn', '#ff5a3c');
    }
    drawShop(state);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
