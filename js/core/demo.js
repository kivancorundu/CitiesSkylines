// Ana menü arka planı için küçük bir demo şehir kurar
import { createState } from './state.js';
import { N, TILE, TILES, idx } from './constants.js';
import { initRuntime, tick } from '../sim/simulation.js';
import * as A from '../sim/actions.js';

export function buildDemoCity(ticks = 900) {
  const s = createState(1001, 'Demo', 'valley');
  initRuntime(s);
  s.money = 1e8; s.milestone = 9; s.settings.disasters = false; s.settings.advisor = false;
  const hz = N / 2; let hwEnd = 0; for (let x = 0; x < N; x++) if (s.road[idx(x, hz)]) hwEnd = x;
  const t0 = Math.floor(TILES / 2 - 1.5) * TILE, z0 = t0 + 2, z1 = t0 + 3 * TILE - 3;
  let riverX = hwEnd; while (riverX < N - 1 && !s.water[idx(riverX + 1, hz)]) riverX++;
  const east = Math.min(t0 + 3 * TILE - 2, riverX - 1);
  A.buildRoad(s, A.linePath(hwEnd, hz, east, hz), 4);
  const vx = []; for (let x = hwEnd + 1; x <= east; x += 12) vx.push(x);
  for (const x of vx) A.buildRoad(s, A.linePath(x, z0, x, z1), x === vx[1] ? 3 : 1);
  for (const z of [hz - 12, hz - 24, hz + 12]) if (z > z0 && z < z1) A.buildRoad(s, A.linePath(vx[0], z, vx[vx.length - 1], z), 1);
  const cells = []; for (let i = 0; i < N * N; i++) if (s.road[i] && s.road[i] !== 6) cells.push([i % N, (i / N) | 0]);
  A.buildNetwork(s, 'pipeW', cells); A.buildNetwork(s, 'pipeS', cells);
  A.paintZone(s, A.rectCells(t0, z0, east, hz - 26), 1);
  A.paintZone(s, A.rectCells(t0, hz - 25, east, hz - 13), 3);
  A.paintZone(s, A.rectCells(t0, hz - 11, east, hz - 2), 6);
  A.paintZone(s, A.rectCells(t0, hz - 1, east, hz + 2), 8);
  A.paintZone(s, A.rectCells(t0, hz + 3, vx[2] || east, z1), 11);
  A.paintZone(s, A.rectCells((vx[2] || east) + 1, hz + 3, east, z1), 9);
  const place = (k, cx, cz) => {
    for (let r = 0; r < 14; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      for (let f = 0; f < 4; f++) { const res = A.placeService(s, k, cx + dx, cz + dz, f); if (res.ok) { const c = []; for (let z = res.b.z - 1; z <= res.b.z + res.b.sz; z++) for (let x = res.b.x - 1; x <= res.b.x + res.b.sx; x++) c.push([x, z]); A.buildNetwork(s, 'pipeW', c); A.buildNetwork(s, 'pipeS', c); return res.b; } }
    }
    return null;
  };
  place('water_pump', riverX - 2, hz - 10); place('sewage_outlet', riverX - 2, hz + 14);
  for (let k = 0; k < 4; k++) place('wind_turbine', vx[1] + 3, hz + 6);
  place('coal_small', east - 4, hz + 18); place('clinic', vx[1] + 3, hz - 16); place('elementary', vx[2] + 3, hz - 30);
  place('city_park', vx[0] + 5, hz - 6); place('fire_house', vx[3] + 3, hz - 18); place('police_station', vx[2] + 3, hz - 6); place('landfill', east - 6, z1 - 4);
  for (let t = 0; t < ticks; t++) tick(s);
  s.time.month = 5; s.time.monthsElapsed = 1; s.time.tod = 2; s.settings.icons = false; s.weather.state = 'clear'; s.weather.cloud = 0.1; s.weather.rain = 0; s.weather.snowCover = 0;
  return s;
}
