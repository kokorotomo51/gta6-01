// SOLMARINA's city: the road grid, the blocks between them, the buildings, the
// palms, the beach and the sea. Built once from a seed; the world is the same
// every visit with the same seed, different with another.

import { CITY, PALETTE, WORLD } from './config.js';

function rectsOverlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export function buildCity(random) {
  const { roadsV, roadsH, roadWidth, sidewalk, sandTop, seaTop } = CITY;
  const half = roadWidth / 2;
  const buildings = [];
  const palms = [];
  const trees = [];
  const props = [];

  // Block bounds: the gaps between neighbouring roads, inset by the sidewalks.
  const xs = [0, ...roadsV, WORLD.width];
  const ys = [0, ...roadsH, WORLD.height];
  const blocks = [];
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      const x0 = xs[i] + (i === 0 ? 0 : half + sidewalk);
      const x1 = xs[i + 1] - (i === xs.length - 2 ? 0 : half + sidewalk);
      const y0 = ys[j] + (j === 0 ? 0 : half + sidewalk);
      const y1 = ys[j + 1] - (j === ys.length - 2 ? 0 : half + sidewalk);
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      blocks.push({ x0, y0, x1, y1, col: i, row: j });
    }
  }

  // One block is the central plaza (Downtown), one is the park (Old Town),
  // one is the marina lot (Marina Bay). The rest get buildings.
  const plaza = blocks.find((b) => b.col === 2 && b.row === 1);
  const park = blocks.find((b) => b.col === 1 && b.row === 2);
  const marinaLot = blocks.find((b) => b.col === 4 && b.row === 1);
  const docks = blocks.find((b) => b.col === 4 && b.row === 0);

  for (const block of blocks) {
    if (block === plaza || block === park) continue;
    if (block.y0 > sandTop) continue; // beach blocks stay open sand
    const bw = block.x1 - block.x0;
    const bh = block.y1 - block.y0;
    // 1-4 buildings per block, on a loose grid with alleys between them.
    const cols = bw > 380 ? 2 : 1;
    const rows = bh > 340 ? 2 : 1;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (random() < 0.08) continue; // occasional empty lot
        const cw = bw / cols;
        const ch = bh / rows;
        const w = cw * (0.62 + random() * 0.3);
        const h = ch * (0.6 + random() * 0.32);
        const x = block.x0 + c * cw + (cw - w) / 2 + (random() - 0.5) * 14;
        const y = block.y0 + r * ch + (ch - h) / 2 + (random() - 0.5) * 14;
        const downtown = block.col === 2 && block.row <= 1;
        const tall = downtown && random() < 0.55;
        buildings.push({
          x0: x, y0: y, x1: x + w, y1: y + h,
          roof: PALETTE.roofs[Math.floor(random() * PALETTE.roofs.length)],
          height: tall ? 26 + random() * 22 : 8 + random() * 10,
          tall,
          windows: Math.floor(random() * 3),
        });
      }
    }
    // A few street trees inside residential blocks.
    if (random() < 0.85) {
      trees.push({
        x: block.x0 + 30 + random() * (bw - 60),
        y: block.y0 + 30 + random() * (bh - 60),
        r: 10 + random() * 6,
      });
      if (random() < 0.5) {
        trees.push({
          x: block.x0 + 30 + random() * (bw - 60),
          y: block.y0 + 30 + random() * (bh - 60),
          r: 9 + random() * 5,
        });
      }
    }
  }

  // Park: a ring of trees and a pond.
  if (park) {
    for (let i = 0; i < 26; i += 1) {
      trees.push({
        x: park.x0 + 24 + random() * (park.x1 - park.x0 - 48),
        y: park.y0 + 24 + random() * (park.y1 - park.y0 - 48),
        r: 11 + random() * 8,
      });
    }
    props.push({ kind: 'pond', x: (park.x0 + park.x1) / 2, y: (park.y0 + park.y1) / 2, r: 64 });
  }

  // Plaza: fountain in the middle, benches around it.
  if (plaza) {
    props.push({ kind: 'fountain', x: (plaza.x0 + plaza.x1) / 2, y: (plaza.y0 + plaza.y1) / 2, r: 46 });
  }

  // Beach palms along the sand.
  for (let x = 80; x < WORLD.width - 40; x += 90 + random() * 130) {
    palms.push({ x, y: sandTop + 26 + random() * 70, r: 13 + random() * 5 });
  }
  // Palms along the marina promenade.
  for (let y = 500; y < 2100; y += 150 + random() * 90) {
    palms.push({ x: 3440 + random() * 60, y, r: 12 + random() * 5 });
  }

  // The golden car lot at the marina (mission 5's prize) and the casino.
  const goldenLot = marinaLot
    ? { x: (marinaLot.x0 + marinaLot.x1) / 2, y: (marinaLot.y0 + marinaLot.y1) / 2 }
    : { x: 3050, y: 1400 };
  const casino = docks
    ? { x: (docks.x0 + docks.x1) / 2, y: (docks.y0 + docks.y1) / 2 }
    : { x: 3050, y: 700 };

  // Fixed landmarks the missions point at (world coordinates, not random).
  const landmarks = {
    garage: { x: 1890, y: 1710, name: "Mara's Garage" }, // Downtown south junction
    docks: { x: 3050, y: 620, name: 'Portside Docks' },
    oldTown: { x: 700, y: 1400, name: 'Old Town Square' },
    casino: { x: casino.x, y: casino.y, name: 'Golden Gull Casino' },
    goldenLot,
    hospital: { x: 1160, y: 430, name: 'Solmarina General' },
    gunShop: { x: 2620, y: 1070, name: 'Solmarina Arms' },
    sprayShop: { x: 1160, y: 1710, name: 'Sunset Spray Shop' },
    hideout: { x: 430, y: 2250, name: 'Hideout' },
    beach: { x: 1800, y: 2460, name: 'Beachfront' },
  };

  function solidAt(x, y) {
    if (x < 8 || y < 8 || x > WORLD.width - 8 || y > WORLD.height - 8) return true;
    if (y >= seaTop) return true; // the sea is not walkable
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return true;
    }
    return false;
  }

  function circleHitsSolid(x, y, r) {
    if (solidAt(x - r, y) || solidAt(x + r, y) || solidAt(x, y - r) || solidAt(x, y + r)) return true;
    if (solidAt(x - r * 0.7, y - r * 0.7) || solidAt(x + r * 0.7, y - r * 0.7)
      || solidAt(x - r * 0.7, y + r * 0.7) || solidAt(x + r * 0.7, y + r * 0.7)) return true;
    return false;
  }

  /** Is the point on a road (drivable)? */
  function onRoad(x, y) {
    for (const rx of roadsV) if (Math.abs(x - rx) <= half) return true;
    for (const ry of roadsH) if (Math.abs(y - ry) <= half) return true;
    return false;
  }

  /** A random point on a road, for spawning traffic and parked cars. */
  function randomRoadPoint(randomFn) {
    if (randomFn() < 0.55) {
      const rx = roadsV[Math.floor(randomFn() * roadsV.length)];
      return { x: rx + (randomFn() < 0.5 ? -32 : 32), y: 60 + randomFn() * (WORLD.height - 220) };
    }
    const ry = roadsH[Math.floor(randomFn() * roadsH.length)];
    return { x: 60 + randomFn() * (WORLD.width - 120), y: ry + (randomFn() < 0.5 ? -32 : 32) };
  }

  /** A random sidewalk point, for spawning pedestrians. */
  function randomSidewalkPoint(randomFn) {
    const p = randomRoadPoint(randomFn);
    const onV = roadsV.some((rx) => Math.abs(p.x - rx) <= half + sidewalk);
    if (onV) return { x: p.x + (p.x < 1890 ? -half - 8 : half + 8), y: p.y };
    return { x: p.x, y: p.y + (p.y < 1300 ? -half - 8 : half + 8) };
  }

  /** Nearest point on the road network (used to snap the player back onto roads). */
  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const rx of roadsV) {
      const d = Math.abs(x - rx);
      if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
    }
    for (const ry of roadsH) {
      const d = Math.abs(y - ry);
      if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
    }
    return best;
  }

  return {
    roadsV, roadsH, roadWidth, sidewalk, sandTop, seaTop,
    buildings, palms, trees, props, landmarks, blocks, plaza, park,
    solidAt, circleHitsSolid, onRoad, randomRoadPoint, randomSidewalkPoint, nearestRoadPoint,
    rectsOverlap,
  };
}
