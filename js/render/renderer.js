// Sahne yöneticisi: ışıklar, gün/gece, gökyüzü, alt görünümler
import * as THREE from '../vendor/three.module.min.js';
import { N, CS, HALF, clamp, lerp, heightAt } from '../core/constants.js';
import { CameraController } from './camera.js';
import { TerrainView } from './terrain.js';
import { RoadView } from './roads.js';
import { BuildingView } from './buildings.js';
import { TreeView } from './trees.js';
import { VehicleView } from './vehicles.js';
import { Effects } from './effects.js';
import { buildOverlay, buildingTint, roadTint } from './infoviews.js';

export class Renderer {
  constructor(canvas, getState) {
    this.getState = getState;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfd4e6, 900, 3800);
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 9000);
    this.cam = new CameraController(this.camera, canvas, getState);
    this.uniforms = { uNight: { value: 0 }, uSnow: { value: 0 } };
    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x5a6a4a, 1.0);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.terrain = new TerrainView(this.scene);
    this.terrain.uniforms.uSnow = this.uniforms.uSnow;
    this.roads = new RoadView(this.scene, this.uniforms);
    this.buildings = new BuildingView(this.scene, this.uniforms);
    this.trees = new TreeView(this.scene, this.uniforms);
    this.vehicles = new VehicleView(this.scene, this.uniforms);
    this.effects = new Effects(this.scene, this.camera);
    this.view = null; this.toolFlags = {};
    this.raycaster = new THREE.Raycaster();
    this.lastSeason = -1;
    this.ovTimer = 0;
    this.skyDay = new THREE.Color(0x9ec9ec); this.skyNight = new THREE.Color(0x0b1424); this.skyDusk = new THREE.Color(0xe8a070);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  resetForState(s) {
    const d = s.rt.dirty; d.terrain = d.roadMesh = d.buildings = d.trees = d.overlay = true;
    this.vehicles.clear();
    this.cam.focus(0, 0, 420);
    const hz = N / 2;
    this.cam.tTarget.set((N * 0.38) * CS - HALF, 0, hz * CS - HALF);
  }

  setView(v) { this.view = v; const s = this.getState(); if (s) { s.rt.dirty.buildings = true; s.rt.dirty.roadMesh = true; s.rt.dirty.overlay = true; } }

  // Fare altındaki hücre (yükseklik haritasına ışın yürütme)
  pick(clientX, clientY) {
    const s = this.getState(); if (!s) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const o = this.raycaster.ray.origin, dir = this.raycaster.ray.direction;
    let t = 0, prev = null;
    const step = 2;
    for (let k = 0; k < 4000; k++) {
      const x = o.x + dir.x * t, y = o.y + dir.y * t, z = o.z + dir.z * t;
      const h = Math.abs(x) < HALF && Math.abs(z) < HALF ? Math.max(heightAt(s, x, z), -0.6) : -14;
      if (y <= h) {
        // ince arama
        let a = prev ?? t - step, b = t;
        for (let j = 0; j < 8; j++) { const m = (a + b) / 2; const px = o.x + dir.x * m, py = o.y + dir.y * m, pz = o.z + dir.z * m; const hh = Math.max(heightAt(s, px, pz), -0.6); if (py <= hh) b = m; else a = m; }
        const px = o.x + dir.x * b, pz = o.z + dir.z * b;
        const cx = Math.floor((px + HALF) / CS), cz = Math.floor((pz + HALF) / CS);
        if (cx < 0 || cz < 0 || cx >= N || cz >= N) return null;
        return { x: cx, z: cz, wx: px, wz: pz };
      }
      prev = t; t += step * (1 + t / 600);
      if (t > 8000) break;
    }
    return null;
  }

  frame(dt, speedMul, opts) {
    const s = this.getState(); if (!s) return;
    const d = s.rt.dirty;
    this.cam.update(dt);
    // gün/gece ve hava
    const tod = s.time.tod;
    const dayF = s.settings.dayNight ? s.rt.daylight : 1;
    const night = 1 - dayF;
    const sunAng = ((tod - 6) / 24) * Math.PI * 2;
    const t = this.cam.target;
    const sd = new THREE.Vector3(Math.cos(sunAng) * 0.6 + 0.2, Math.max(0.15, Math.sin(sunAng)), 0.45).normalize();
    if (!s.settings.dayNight) sd.set(0.45, 0.8, 0.35).normalize();
    const range = clamp(this.cam.dist * 1.1, 200, 1300);
    this.sun.position.set(t.x + sd.x * 1200, t.y + sd.y * 1200, t.z + sd.z * 1200);
    this.sun.target.position.copy(t);
    const sc = this.sun.shadow.camera; sc.left = -range; sc.right = range; sc.top = range; sc.bottom = -range; sc.near = 10; sc.far = 3000; sc.updateProjectionMatrix();
    this.sun.castShadow = s.settings.shadows;
    const cloud = s.weather.cloud;
    this.sun.intensity = (0.15 + 2.1 * dayF) * (1 - cloud * 0.55) + (s.rt.flash || 0) * 4;
    this.hemi.intensity = 0.35 + 0.85 * dayF + (s.rt.flash || 0) * 2;
    if (s.rt.flash) s.rt.flash = Math.max(0, s.rt.flash - dt * 4);
    const dusk = clamp(1 - Math.abs(dayF - 0.5) * 2, 0, 1) * (dayF > 0 && dayF < 1 ? 1 : 0);
    const sky = this.skyNight.clone().lerp(this.skyDay, dayF).lerp(this.skyDusk, dusk * 0.5);
    sky.lerp(new THREE.Color(0x8a96a4), cloud * 0.5 * dayF);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    const fogF = s.weather.fog || 0;
    this.scene.fog.near = lerp(900, 120, fogF) + this.cam.dist * 0.5; this.scene.fog.far = lerp(4200, 900, fogF) + this.cam.dist;
    this.sun.color.setHSL(0.1, 0.6, 0.5 + 0.45 * dayF);
    this.uniforms.uNight.value = clamp(night * 1.2, 0, 1);
    this.uniforms.uSnow.value = s.weather.snowCover;
    this.roads.setNight(night);
    this.terrain.waterMat.color.setHex(0x2f6f8f).lerp(new THREE.Color(0x0a1a28), night * 0.7);
    // yeniden yapılandırmalar
    if (d.terrain) { this.terrain.rebuild(s); d.terrain = false; d.roadMesh = true; d.buildings = true; d.trees = true; }
    if (d.roadMesh || d.roads || d.netMesh) { this.roads.rebuild(s, roadTint(s, this.view)); d.roadMesh = false; d.netMesh = false; }
    if (d.buildings) { this.buildings.rebuild(s, buildingTint(s, this.view)); d.buildings = false; d.icons = true; }
    const season = s.time.month;
    if (d.trees || season !== this.lastSeason) { this.trees.rebuild(s, season); d.trees = false; this.lastSeason = season; }
    this.ovTimer -= dt;
    if (d.overlay || (this.view && this.ovTimer <= 0)) {
      this.ovTimer = 0.5;
      const tmp = this.ovBuf || (this.ovBuf = new Uint8Array(N * N * 4));
      buildOverlay(s, tmp, { view: this.view, tool: this.toolFlags, buyable: opts.buyable });
      if (opts.overlayHook) opts.overlayHook(tmp);
      this.terrain.setOverlay(tmp, this.toolFlags.zoning || this.toolFlags.grid);
      d.overlay = false;
    }
    if (this.view === 'traffic' && this.ovTimer === 0.5) this.roads.rebuild(s, roadTint(s, this.view));
    // araçlar
    while (s.rt.vehicleSpawn.length) { const v = s.rt.vehicleSpawn.shift(); this.vehicles.spawn(s, v.path, v.kind); }
    this.vehicles.update(s, dt, speedMul, this.view === 'transit' || opts.showLines);
    this.buildings.animate(dt, s.weather.windStrength, speedMul === 0);
    this.effects.update(s, dt, speedMul, t, night, this.cam.dist);
    const sel = s.rt.selected ? s.buildings[s.rt.selected] : null;
    this.buildings.setSelection(s, sel);
    this.renderer.render(this.scene, this.camera);
  }
}
