// Paylaşılan geometriler ve malzemeler
import * as THREE from '../vendor/three.module.min.js';

export function baseBox() { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; }
export function baseCyl(seg = 12, top = 0.5, bot = 0.5) { const g = new THREE.CylinderGeometry(top, bot, 1, seg); g.translate(0, 0.5, 0); return g; }
export function baseCone(seg = 8) { const g = new THREE.ConeGeometry(0.5, 1, seg); g.translate(0, 0.5, 0); return g; }
export function baseSphere() { const g = new THREE.IcosahedronGeometry(0.5, 1); g.translate(0, 0.5, 0); return g; }
export function gableGeo() {
  // x boyunca sırt, taban y=0, yükseklik 1, genişlik 1 (z)
  const v = [
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 0, -0.5, 0.5, 1, 0, -0.5, 1, 0, // ön eğim
    -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 1, 0, -0.5, 0, 0.5, 0.5, 1, 0, 0.5, 0, 0.5, // arka eğim
    -0.5, 0, -0.5, -0.5, 1, 0, -0.5, 0, 0.5, // sol üçgen
    0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0, // sağ üçgen
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

// Pencere gölgelendiricili malzeme: gündüz koyu camlar, gece yanan pencereler
export function windowMaterial(uniforms) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = uniforms.uNight;
    sh.uniforms.uSnow = uniforms.uSnow;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN; varying float vLocalY;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        mat4 cskIM = mat4(1.0);
        #ifdef USE_INSTANCING
          cskIM = instanceMatrix;
        #endif
        vec4 wp4 = modelMatrix * cskIM * vec4(transformed, 1.0);
        vWPos = wp4.xyz; vWN = normalize(mat3(modelMatrix * cskIM) * objectNormal);
        vLocalY = transformed.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN; varying float vLocalY; uniform float uNight; uniform float uSnow;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wall = 1.0 - step(0.5, abs(vWN.y));
        float hc = abs(vWN.x) > 0.5 ? vWPos.z : vWPos.x;
        float fy = fract(vWPos.y / 3.1); float fx = fract(hc / 2.4);
        float win = step(0.32, fy) * step(fy, 0.78) * step(0.18, fx) * step(fx, 0.82) * wall * step(0.03, vLocalY) * step(vLocalY, 0.985);
        float wh = fract(sin(dot(floor(vec3(hc / 2.4, vWPos.y / 3.1, vWN.x * 3.0 + vWN.z * 7.0)), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.29, 0.36), win * 0.6);
        float roof = step(0.5, vWN.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), roof * uSnow * 0.9);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += win * uNight * step(0.42, wh) * vec3(1.0, 0.8, 0.48) * (0.6 + 0.4 * wh);`);
  };
  return m;
}

export function plainMaterial(uniforms) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnow = uniforms.uSnow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUpW;').replace('#include <project_vertex>', `#include <project_vertex>
      mat4 cskIM2 = mat4(1.0);
      #ifdef USE_INSTANCING
        cskIM2 = instanceMatrix;
      #endif
      vUpW = normalize(mat3(modelMatrix * cskIM2) * objectNormal).y;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vUpW; uniform float uSnow;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93,0.95,0.98), uSnow * smoothstep(0.6, 0.95, vUpW) * 0.9);');
  };
  return m;
}

// Basit geometri birleştirme (indeksli -> indekssiz)
export function mergeGeos(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    if (!g.attributes.normal) g.computeVertexNormals();
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

// Dinamik kapasiteli örneklenmiş mesh
export class Pool {
  constructor(scene, geo, mat, cap = 256, shadows = true) {
    this.scene = scene; this.geo = geo; this.mat = mat; this.cap = cap; this.shadows = shadows;
    this.make();
  }
  make() {
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.dispose(); }
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.instanceColor.array.fill(1);
    this.mesh.count = 0; this.mesh.castShadow = this.shadows; this.mesh.receiveShadow = this.shadows;
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  ensure(n) { if (n > this.cap) { while (this.cap < n) this.cap *= 2; this.make(); } }
  set(i, m, c) { this.mesh.setMatrixAt(i, m); if (c) this.mesh.setColorAt(i, c); }
  commit(n) {
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  set visible(v) { this.mesh.visible = v; }
}
