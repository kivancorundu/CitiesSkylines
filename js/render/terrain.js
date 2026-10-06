// Arazi ağı, su yüzeyi ve bilgi görünümü katmanı
import * as THREE from '../vendor/three.module.min.js';
import { N, CS, HALF, WATER_Y, vidx, idx, clamp } from '../core/constants.js';
import { hash2 } from '../core/rng.js';

export class TerrainView {
  constructor(scene) {
    this.scene = scene;
    const N1 = N + 1;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N1 * N1 * 3);
    this.col = new Float32Array(N1 * N1 * 3);
    for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
      const v = z * N1 + x; this.pos[v * 3] = x * CS - HALF; this.pos[v * 3 + 2] = z * CS - HALF;
    }
    const index = new Uint32Array(N * N * 6); let k = 0;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const a = z * N1 + x, b = a + 1, c = a + N1, d = c + 1;
      index[k++] = a; index[k++] = c; index[k++] = b; index[k++] = b; index[k++] = c; index[k++] = d;
    }
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo = g;
    this.uniforms = { uSnow: { value: 0 } };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSnow = this.uniforms.uSnow;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUpN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUpN = normal.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vUpN;\nuniform float uSnow;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92,0.94,0.98), uSnow * smoothstep(0.55, 0.9, vUpN));');
    };
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    // bilgi katmanı
    this.ovData = new Uint8Array(N * N * 4);
    this.ovTex = new THREE.DataTexture(this.ovData, N, N, THREE.RGBAFormat);
    this.ovTex.magFilter = THREE.NearestFilter; this.ovTex.minFilter = THREE.NearestFilter; this.ovTex.needsUpdate = true;
    this.ovUniforms = { uTex: { value: this.ovTex }, uGrid: { value: 0 }, uSmooth: { value: 0 } };
    const ovMat = new THREE.ShaderMaterial({
      uniforms: this.ovUniforms, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: `varying vec2 vUv; void main(){ vUv = (position.xz + ${HALF.toFixed(1)}) / ${(N * CS).toFixed(1)}; gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(0.0,0.08,0.0),1.0);} `,
      fragmentShader: `uniform sampler2D uTex; uniform float uGrid; varying vec2 vUv;
        void main(){ vec4 c = texture2D(uTex, vUv); vec2 f = fract(vUv * ${N.toFixed(1)});
          float edge = step(f.x, 0.06) + step(0.94, f.x) + step(f.y, 0.06) + step(0.94, f.y);
          float odd = mod(floor(c.a * 255.0 + 0.5), 2.0);
          if (uGrid > 0.5 && odd > 0.5) { c.a = min(1.0, c.a + edge * 0.35); c.rgb = mix(c.rgb, vec3(1.0), min(1.0, edge) * 0.35); }
          if (c.a < 0.01) discard; gl_FragColor = c; }`,
    });
    this.overlay = new THREE.Mesh(g, ovMat);
    this.overlay.renderOrder = 2;
    scene.add(this.overlay);

    // su
    const wg = new THREE.PlaneGeometry(N * CS, N * CS, 1, 1); wg.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.MeshPhongMaterial({ color: 0x2f6f8f, transparent: true, opacity: 0.82, shininess: 90, specular: 0x88aacc });
    this.water = new THREE.Mesh(wg, this.waterMat);
    this.water.position.y = WATER_Y; this.water.renderOrder = 1;
    scene.add(this.water);

    // harita dışı zemin ve kenar duvarları
    const og = new THREE.PlaneGeometry(9000, 9000); og.rotateX(-Math.PI / 2);
    this.outside = new THREE.Mesh(og, new THREE.MeshLambertMaterial({ color: 0x5b6e45 }));
    this.outside.position.y = -14; scene.add(this.outside);
    this.skirtGeo = new THREE.BufferGeometry();
    this.skirt = new THREE.Mesh(this.skirtGeo, new THREE.MeshLambertMaterial({ color: 0x6b5a45, side: THREE.DoubleSide }));
    scene.add(this.skirt);
  }

  rebuild(s) {
    const N1 = N + 1, P = this.pos, Cc = this.col;
    for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
      const v = z * N1 + x; const h = s.vh[v]; P[v * 3 + 1] = h;
      const hx = s.vh[vidx(Math.min(N, x + 1), z)] - s.vh[vidx(Math.max(0, x - 1), z)];
      const hz = s.vh[vidx(x, Math.min(N, z + 1))] - s.vh[vidx(x, Math.max(0, z - 1))];
      const slope = Math.hypot(hx, hz) / (2 * CS);
      const n = hash2(x, z, 3) * 0.08 - 0.04;
      let r = 0.36 + n, g = 0.52 + n * 1.3, b = 0.24 + n * 0.5; // çimen
      // kaynak tonları
      const ci = idx(Math.min(N - 1, x), Math.min(N - 1, z));
      if (s.res[ci] === 1) { r += 0.12; g += 0.05; b -= 0.02; }
      else if (s.res[ci] === 2) { r -= 0.08; g -= 0.08; b -= 0.06; }
      if (h < 0.6) { const t = clamp((0.6 - h) / 1.6, 0, 1); r = r + (0.76 - r) * t; g = g + (0.7 - g) * t; b = b + (0.5 - b) * t; }
      if (h < -1.2) { r = 0.45; g = 0.42; b = 0.32; }
      if (slope > 0.35) { const t = clamp((slope - 0.35) * 2, 0, 1); r = r + (0.5 - r) * t; g = g + (0.45 - g) * t; b = b + (0.38 - b) * t; }
      if (h > 32) { const t = clamp((h - 32) / 12, 0, 1); r = r + (0.55 - r) * t; g = g + (0.53 - g) * t; b = b + (0.5 - b) * t; }
      if (h > 48) { const t = clamp((h - 48) / 8, 0, 1); r = r + (0.95 - r) * t; g = g + (0.96 - g) * t; b = b + (0.98 - b) * t; }
      Cc[v * 3] = r; Cc[v * 3 + 1] = g; Cc[v * 3 + 2] = b;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.buildSkirt(s);
  }

  buildSkirt(s) {
    const pts = [];
    const edge = (x0, z0, x1, z1) => {
      const ha = s.vh[vidx(x0, z0)], hb = s.vh[vidx(x1, z1)];
      const ax = x0 * CS - HALF, az = z0 * CS - HALF, bx = x1 * CS - HALF, bz = z1 * CS - HALF;
      pts.push(ax, Math.max(ha, WATER_Y), az, bx, Math.max(hb, WATER_Y), bz, bx, -14, bz, ax, Math.max(ha, WATER_Y), az, bx, -14, bz, ax, -14, az);
    };
    for (let i = 0; i < N; i++) { edge(i, 0, i + 1, 0); edge(i, N, i + 1, N); edge(0, i, 0, i + 1); edge(N, i, N, i + 1); }
    this.skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.skirtGeo.computeVertexNormals();
  }

  setOverlay(data, grid) {
    this.ovData.set(data);
    this.ovTex.needsUpdate = true;
    this.ovUniforms.uGrid.value = grid ? 1 : 0;
  }
}
