/* ============================================================
   The Gilded Palm — interactive 3D walkthrough
   Procedural house model + guided first-person camera (Three.js)
   ============================================================ */
import * as THREE from 'three';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, t) => { const x = clamp((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const easeInOutCubic = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/* ------------------------------------------------------------
   Tour data — positions in meters, eye height ~1.55
   ------------------------------------------------------------ */
const stops = [
  { label: 'Arrival', name: 'Arrival', pos: V3(5.2, 1.7, 12.8), look: V3(1.6, 2.0, 5.2),
    desc: 'Welcome to The Gilded Palm. Your dedicated private entrance is at the front door, with back-to-back parking for two cars in the driveway.' },
  { label: 'Living Room', name: 'Living Room', pos: V3(3.4, 1.55, 3.7), look: V3(-1.7, 1.45, 0.7),
    desc: 'Sink into the sectional under a 120-inch laser projector — movie nights, big games, zero compromises.' },
  { label: 'Kitchen', name: 'Kitchen', pos: V3(-4.1, 1.55, 3.6), look: V3(-7.8, 1.4, 3.6),
    desc: 'A fully equipped galley kitchen — stove, oven, microwave, fridge and sink — dressed in white shaker cabinets and brushed gold.' },
  { label: 'Laundry', name: 'Laundry Room', pos: V3(-6.4, 1.55, 1.35), look: V3(-7.9, 1.25, 1.55),
    desc: 'Full-size washer and dryer with extra storage, so you can pack light and stay longer.' },
  { label: 'Bunk Room', name: 'Bedroom 3 · Bunk Room', pos: V3(-6.3, 1.55, -2.0), look: V3(-5.5, 1.2, -3.8),
    desc: 'The bunk room sleeps three across three twin mattresses — top bunk, bottom bunk and a rolling trundle — plus its own TV.' },
  { label: 'Bedroom 2', name: 'Bedroom 2', pos: V3(-2.9, 1.55, -2.0), look: V3(-2.6, 1.15, -4.5),
    desc: 'A calm queen bedroom in warm oak and linen, with soft lamplight and sweet dreams built in.' },
  { label: 'Full Bath', name: 'Full Bathroom', pos: V3(4.35, 1.55, -0.35), look: V3(6.5, 1.35, -0.1),
    desc: 'Full bathroom with a walk-in shower, fresh towels and all the essentials for a comfortable stay.' },
  { label: 'Master Suite', name: 'Master Bedroom', pos: V3(1.3, 1.55, -2.1), look: V3(3.2, 1.25, -4.4),
    desc: 'The master suite: queen bed, mounted TV and a private full bathroom — designed for comfort and a restful night’s sleep.' },
  { label: 'Master Bath', name: 'Master Bathroom', pos: V3(4.8, 1.5, -3.0), look: V3(6.35, 1.25, -4.2),
    desc: 'A spa-grade ensuite — marble walls, a brushed-gold rainfall shower and honeycomb tile underfoot.' },
  { label: 'Backyard', name: 'Backyard Oasis', pos: V3(0.2, 1.65, -6.6), look: V3(3.2, 1.1, -11.0),
    desc: 'Your private oasis: pool spa, mini-golf putting green, pergola bar, grill and a pickleball practice net under string lights.' },
];

// Waypoints between consecutive stops (walks through real doorways)
const segs = [
  [V3(2.4, 1.65, 8.6), V3(1.75, 1.55, 5.6), V3(1.75, 1.55, 4.4)],
  [V3(0.2, 1.55, 3.3), V3(-3.2, 1.55, 3.2)],
  [V3(-6.6, 1.55, 3.4), V3(-7.0, 1.55, 2.35), V3(-6.9, 1.55, 1.7)],
  [V3(-6.9, 1.55, 0.55), V3(-6.4, 1.55, -0.35), V3(-6.35, 1.55, -1.25)],
  [V3(-6.35, 1.55, -0.5), V3(-2.95, 1.55, -0.5), V3(-2.95, 1.55, -1.4)],
  [V3(-2.95, 1.55, -0.45), V3(0.5, 1.55, -0.4), V3(2.9, 1.55, -0.38)],
  [V3(3.0, 1.55, -0.4), V3(1.05, 1.55, -0.6), V3(1.05, 1.55, -1.6)],
  [V3(2.9, 1.55, -3.3), V3(4.65, 1.55, -4.0)],
  [V3(4.7, 1.55, -3.95), V3(4.05, 1.55, -3.5), V3(3.9, 1.55, -2.5), V3(1.7, 1.55, -2.5), V3(1.5, 1.55, -4.5), V3(1.5, 1.7, -5.8)],
];

/* ------------------------------------------------------------
   Renderer / scene
   ------------------------------------------------------------ */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 220);

function sizeRenderer() {
  const w = canvas.clientWidth || innerWidth;
  const h = canvas.clientHeight || innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', sizeRenderer);

/* ------------------------------------------------------------
   Canvas textures
   ------------------------------------------------------------ */
function makeCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const skyTex = makeCanvas(512, (g, s) => {
  const grad = g.createLinearGradient(0, 0, 0, s);
  grad.addColorStop(0, '#7fbfe8');
  grad.addColorStop(0.55, '#bcdcef');
  grad.addColorStop(0.8, '#f2e4c8');
  grad.addColorStop(1, '#f7ecd4');
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
});
scene.background = skyTex;
scene.fog = new THREE.Fog(0xe9dfc9, 55, 160);

/* Soft studio environment so metals (gold, steel) reflect properly */
{
  const env = new THREE.Scene();
  env.background = new THREE.Color(0xdcd6c8);
  const P = (w, h, color, x, y, z, rx, ry) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
    p.position.set(x, y, z); p.rotation.set(rx, ry, 0);
    env.add(p);
  };
  P(14, 14, 0xffffff, 0, 8, 0, Math.PI / 2, 0);      // bright ceiling
  P(12, 8, 0xfff0d6, 0, 3, -7, 0, 0);                // warm wall
  P(12, 8, 0xcfe2ec, 0, 3, 7, 0, Math.PI);           // cool wall
  P(14, 14, 0x8a8578, 0, -2, 0, -Math.PI / 2, 0);    // floor
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.06).texture;
  pmrem.dispose();
}

const woodTex = makeCanvas(256, (g, s) => {
  g.fillStyle = '#e3cfa6'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 32) {
    g.fillStyle = `rgba(190,155,105,${0.08 + Math.random() * 0.1})`;
    g.fillRect(0, y, s, 32);
    g.fillStyle = 'rgba(160,125,80,0.35)';
    g.fillRect(0, y, s, 1);
    g.fillRect(Math.random() * s, y, 1.5, 32);
  }
});
woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
woodTex.repeat.set(5, 4);

const paverTex = makeCanvas(256, (g, s) => {
  g.fillStyle = '#d8d5ce'; g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(140,137,130,0.55)'; g.lineWidth = 2;
  for (let i = 0; i <= s; i += 64) {
    g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke();
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke();
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(120,117,110,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * s, Math.random() * s, 22, 22);
  }
});
paverTex.wrapS = paverTex.wrapT = THREE.RepeatWrapping;
paverTex.repeat.set(7, 4);

const marbleTex = makeCanvas(256, (g, s) => {
  g.fillStyle = '#d9e6e0'; g.fillRect(0, 0, s, s);
  g.filter = 'blur(1.5px)';
  for (let i = 0; i < 12; i++) {
    g.strokeStyle = i % 4 === 0 ? 'rgba(201,162,74,0.22)' : 'rgba(255,255,255,0.4)';
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath();
    let x = Math.random() * s, y = Math.random() * s;
    g.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      x += (Math.random() - 0.5) * 150; y += (Math.random() - 0.5) * 150;
      g.quadraticCurveTo(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 50, x, y);
    }
    g.stroke();
  }
  g.filter = 'none';
});
marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping;
marbleTex.repeat.set(2, 2);

/* Tropical sunset scene for the 120" projector screen */
const screenTex2 = makeCanvas(512, (g, s) => {
  const sky = g.createLinearGradient(0, 0, 0, s * 0.6);
  sky.addColorStop(0, '#ffd98c'); sky.addColorStop(0.65, '#ff9d8a'); sky.addColorStop(1, '#f2789e');
  g.fillStyle = sky; g.fillRect(0, 0, s, s * 0.6);
  g.fillStyle = '#ffe9b0';
  g.beginPath(); g.arc(s * 0.62, s * 0.42, 52, 0, Math.PI * 2); g.fill();
  const sea = g.createLinearGradient(0, s * 0.6, 0, s);
  sea.addColorStop(0, '#54c6c9'); sea.addColorStop(1, '#1c8ea6');
  g.fillStyle = sea; g.fillRect(0, s * 0.6, s, s * 0.4);
  g.fillStyle = 'rgba(255,230,170,0.5)';
  for (let i = 0; i < 14; i++) g.fillRect(s * 0.5 + (Math.random() - 0.5) * 140, s * 0.62 + i * 12, 60 + Math.random() * 60, 3);
  g.fillStyle = '#1f4e46';
  g.beginPath(); g.ellipse(s * 0.16, s * 0.6, 90, 26, 0, Math.PI, 0); g.fill();
  g.beginPath(); g.ellipse(s * 0.9, s * 0.6, 70, 18, 0, Math.PI, 0); g.fill();
  g.strokeStyle = '#173a34'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(s * 0.16, s * 0.58); g.quadraticCurveTo(s * 0.2, s * 0.42, s * 0.28, s * 0.38); g.stroke();
  g.fillStyle = '#2c6b52';
  for (let a = 0; a < 6; a++) {
    g.save(); g.translate(s * 0.28, s * 0.38); g.rotate(a * 1.05 - 2.6);
    g.beginPath(); g.ellipse(34, 0, 36, 9, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
});

/* ------------------------------------------------------------
   Materials
   ------------------------------------------------------------ */
const M = (color, r = 0.92, m = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...extra });

const mWall = M(0xf4f1ea, 0.96);
const mWallTan = M(0xe6c8a0, 0.96);
const mCeil = M(0xfbf9f4, 1);
const mFloor = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 });
const mPaver = new THREE.MeshStandardMaterial({ map: paverTex, roughness: 0.95 });
const mMarble = new THREE.MeshStandardMaterial({ map: marbleTex, roughness: 0.35 });
const mWhite = M(0xffffff, 0.7);
const mCream = M(0xefe8db, 1);
const mLinen = M(0xf6f1e7, 1);
const mTanTh = M(0xc98f4e, 1);
const mGold = M(0xc9a227, 0.35, 0.85);
const mSteel = M(0xb9bec4, 0.4, 0.7);
const mBlack = M(0x24262a, 0.55, 0.2);
const mWoodW = M(0xb98a4e, 0.85);
const mWoodD = M(0x74553a, 0.85);
const mOak = M(0xd9b98a, 0.85);
const mGrass = M(0x6fae5a, 1);
const mTurf = M(0x4db544, 1);
const mLeaf = M(0x3f8f47, 1);
const mTrunk = M(0x9a7d55, 1);
const mGray = M(0x8b9097, 0.9);
const mRoof = M(0x5c6066, 0.95);
const mFence = M(0xf2f2f0, 0.95);
const mConcrete = M(0xdcd9d3, 0.98);
const mWater = M(0x4fc3d9, 0.25, 0, { emissive: 0x1a7f96, emissiveIntensity: 0.35 });
const mGlass = new THREE.MeshStandardMaterial({ color: 0xcfe8ef, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22 });
const mGlow = new THREE.MeshBasicMaterial({ color: 0xfff3d6 });
const mBulb = new THREE.MeshBasicMaterial({ color: 0xffdf9e });
const mScreen = new THREE.MeshBasicMaterial({ map: screenTex2 });
const mTV = M(0x101114, 0.3, 0.4, { emissive: 0x0c1420, emissiveIntensity: 0.6 });
const mRug = M(0xe7e0d2, 1);
const mRugGray = M(0xcfcac2, 1);

/* ------------------------------------------------------------
   Geometry helpers
   ------------------------------------------------------------ */
const world = new THREE.Group();
scene.add(world);

function box(w, h, d, mat, x, y, z, ry = 0, parent = world) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cyl(rt, rb, h, mat, x, y, z, seg = 20, parent = world) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function plane(w, h, mat, x, y, z, rx = 0, ry = 0, parent = world) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, 0, 'YXZ');
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const WH = 2.75, T = 0.18, LINTEL = 2.08;

// Wall along X at fixed z; gaps = [x1, x2, topHeight]
function wallX(z, x1, x2, gaps = [], mat = mWall) {
  let cur = x1;
  const solid = (a, b, y0, y1) => { if (b - a > 0.02) box(b - a, y1 - y0, T, mat, (a + b) / 2, (y0 + y1) / 2, z); };
  for (const [g1, g2, top = LINTEL] of gaps) {
    solid(cur, g1, 0, WH);
    solid(g1, g2, top, WH);
    cur = g2;
  }
  solid(cur, x2, 0, WH);
}
// Wall along Z at fixed x; gaps = [z1, z2, topHeight]
function wallZ(x, z1, z2, gaps = [], mat = mWall) {
  let cur = z1;
  const solid = (a, b, y0, y1) => { if (b - a > 0.02) box(T, y1 - y0, b - a, mat, x, (y0 + y1) / 2, (a + b) / 2); };
  for (const [g1, g2, top = LINTEL] of gaps) {
    solid(cur, g1, 0, WH);
    solid(g1, g2, top, WH);
    cur = g2;
  }
  solid(cur, z2, 0, WH);
}

/* ------------------------------------------------------------
   Grounds
   ------------------------------------------------------------ */
{
  const g = plane(70, 56, mGrass, 0, 0, 1, -Math.PI / 2);
  g.receiveShadow = true;
  plane(5.9, 9.4, mConcrete, 5.55, 0.02, 9.95, -Math.PI / 2);       // driveway
  plane(70, 2.6, M(0x565a5e, 1), 0, 0.015, 16.4, -Math.PI / 2);      // street
  plane(70, 1.2, M(0xcfcdc7, 1), 0, 0.02, 14.7, -Math.PI / 2);       // sidewalk
  plane(17.4, 8.6, mPaver, 0, 0.025, -9.55, -Math.PI / 2);           // backyard patio
  plane(16.9, 1.6, mTurf, 0, 0.03, -13.0, -Math.PI / 2);             // turf strip at back fence
  plane(15.4, 10.4, mFloor, -0.5, 0.02, 0, -Math.PI / 2);            // interior wood floor
  plane(3.5, 1.6, M(0xe8e6e0, 0.5), 5.8, 0.035, -0.35, -Math.PI / 2); // bath2 tile
  plane(2.3, 2.1, M(0xefeee9, 0.5), 5.8, 0.035, -3.9, -Math.PI / 2);  // ensuite tile
}

/* ------------------------------------------------------------
   House shell
   ------------------------------------------------------------ */
wallX(5, -8.1, 7.1, [[1.2, 2.3, 2.08]]);                    // front
wallX(-5, -8.1, 7.1, [[0.8, 2.2, 2.2]]);                    // back (slider)
wallZ(-8, -5.1, 5.1);                                       // west
wallZ(7, -5.1, 5.1);                                        // east
wallZ(-3.2, 0.5, 5, [[2.5, 3.9, 2.08]]);                    // kitchen | living
wallX(2.3, -8, -3.2, [[-7.4, -6.6, 2.08]]);                 // kitchen | laundry
wallX(0.5, -8, 7, [[-7.3, -6.5, 2.08], [2.0, 3.3, 2.08]]);  // hall south wall
wallX(-1.2, -8, 7, [[-6.8, -5.9, 2.08], [-3.4, -2.5, 2.08], [0.6, 1.5, 2.08]]); // hall north wall
wallZ(3.4, -1.2, 0.5, [[-0.75, 0.05, 2.08]]);               // hall | bath2
wallZ(-4.7, -5, -1.2);                                      // bunk | bed2
wallZ(-0.5, -5, -1.2);                                      // bed2 | master
wallZ(4.6, -5, -2.8, [[-4.4, -3.6, 2.08]]);                 // master | ensuite
wallX(-2.8, 4.6, 7);                                        // ensuite north wall

// Ceiling + roof
{
  const ceil = box(15.8, 0.1, 10.8, mCeil, -0.5, WH + 0.06, 0);
  ceil.castShadow = false;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT2, 1, 4), mRoof);
  roof.scale.set(8.8, 2.3, 6.3);
  roof.position.set(-0.5, WH + 0.12 + 1.15, 0);
  roof.rotation.y = Math.PI / 4;
  world.add(roof);
  const fascia = box(16.6, 0.22, 11.6, M(0xe8e6e0, 0.9), -0.5, WH + 0.1, 0);
  fascia.castShadow = false;
}

// Porch: columns + slab + gray trim
{
  box(0.3, 2.5, 0.3, mGray, 0.55, 1.25, 5.85);
  box(0.3, 2.5, 0.3, mGray, 2.95, 1.25, 5.85);
  box(3.6, 0.5, 0.34, mGray, 1.75, 2.42, 5.85);
  box(4.0, 0.24, 1.6, M(0xf0eee8, 0.9), 1.75, 2.75, 5.35);
  // door swung open inward so the camera can walk through
  box(1.0, 2.02, 0.05, mWhite, 2.6, 1.01, 4.55, -1.2);
}

/* Window helper: bright pane + frame on a wall face */
function windowOn(x, y, z, w, h, ry, trim = false) {
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: 0xf3ecda }));
  g.add(pane);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.05), trim ? mGray : mWhite);
  fr.position.z = -0.035; g.add(fr);
  const mull = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, 0.02), mWhite);
  mull.position.z = 0.011; g.add(mull);
  const mull2 = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.02), mWhite);
  mull2.position.z = 0.011; g.add(mull2);
  world.add(g);
  return g;
}
// Interior-facing daylight windows
windowOn(6.9, 1.6, 2.6, 1.7, 1.3, -Math.PI / 2);            // living east
windowOn(4.4, 1.6, 4.9, 1.6, 1.3, Math.PI);                 // living front (inside)
windowOn(-5.4, 1.7, 4.9, 1.4, 1.1, Math.PI);                // kitchen front (inside)
windowOn(6.9, 1.6, -2.0, 1.5, 1.2, -Math.PI / 2);           // master east
windowOn(-3.9, 1.65, -4.9, 1.5, 1.2, 0);                    // bed2 back
windowOn(-6.4, 1.65, -4.9, 1.4, 1.1, 0);                    // bunk back
// Exterior facade windows (with gray trim)
windowOn(4.4, 1.6, 5.11, 1.6, 1.3, 0, true);
windowOn(-5.4, 1.7, 5.11, 1.4, 1.1, 0, true);
windowOn(-6.5, 1.6, 5.11, 1.1, 1.1, 0, true);
box(0.5, 2.7, 0.34, mGray, -7.9, 1.35, 5.05);
box(0.5, 2.7, 0.34, mGray, 6.9, 1.35, 5.05);

// Sliding back door
{
  box(1.6, 2.2, 0.06, mGlass, 1.5, 1.1, -5.0);
  box(0.06, 2.2, 0.06, mWhite, 0.82, 1.1, -5.0);
  box(0.06, 2.2, 0.06, mWhite, 2.18, 1.1, -5.0);
  box(1.5, 0.06, 0.06, mWhite, 1.5, 2.2, -5.0);
}

/* ------------------------------------------------------------
   Furnishings
   ------------------------------------------------------------ */
function sofa(w, x, z, ry, mat = mCream) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; world.add(g);
  const b = (bw, bh, bd, bx, by, bz) => box(bw, bh, bd, mat, bx, by, bz, 0, g);
  b(w, 0.42, 0.95, 0, 0.24, 0);            // base
  b(w, 0.55, 0.24, 0, 0.72, -0.37);        // back
  b(0.24, 0.34, 0.95, -w / 2 + 0.12, 0.62, 0);
  b(0.24, 0.34, 0.95, w / 2 - 0.12, 0.62, 0);
  const seats = Math.max(2, Math.round(w / 0.85));
  for (let i = 0; i < seats; i++) {
    b(w / seats - 0.06, 0.13, 0.8, -w / 2 + (i + 0.5) * (w / seats), 0.51, 0.04);
    b(w / seats - 0.1, 0.3, 0.14, -w / 2 + (i + 0.5) * (w / seats), 0.78, -0.32);
  }
  return g;
}

function bedQ(x, z, frameMat, blanketMat, headboardH = 1.15) {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  const b = (bw, bh, bd, bx, by, bz, mat) => box(bw, bh, bd, mat, bx, by, bz, 0, g);
  b(1.68, 0.28, 2.14, 0, 0.2, 0, frameMat);
  b(1.72, headboardH, 0.1, 0, headboardH / 2 + 0.1, -1.1, frameMat);
  b(1.58, 0.24, 2.0, 0, 0.44, 0, mLinen);
  b(1.58, 0.1, 0.9, 0, 0.55, 0.4, blanketMat);
  b(0.62, 0.16, 0.4, -0.4, 0.6, -0.76, mWhite);
  b(0.62, 0.16, 0.4, 0.4, 0.6, -0.76, mWhite);
  return g;
}

function nightstand(x, z, mat = mWhite) {
  box(0.52, 0.55, 0.42, mat, x, 0.28, z);
  cyl(0.025, 0.025, 0.3, mGold, x, 0.7, z, 10);
  const shade = cyl(0.11, 0.14, 0.2, mGlow, x, 0.92, z, 14);
  shade.castShadow = false;
  return shade;
}

const fans = [];
function fan(x, z) {
  const g = new THREE.Group(); g.position.set(x, WH - 0.28, z); world.add(g);
  cyl(0.05, 0.05, 0.22, mBlack, 0, 0.12, 0, 10, g);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), mGlow);
  glow.position.y = -0.08; g.add(glow);
  const blades = new THREE.Group(); g.add(blades);
  for (let i = 0; i < 5; i++) {
    const bl = box(0.72, 0.02, 0.14, mWoodD, 0, 0, 0, 0, blades);
    bl.position.set(Math.cos(i * Math.PI * 2 / 5) * 0.42, 0.02, Math.sin(i * Math.PI * 2 / 5) * 0.42);
    bl.rotation.y = -i * Math.PI * 2 / 5;
  }
  fans.push(blades);
}

function ceilLight(x, z, r = 0.18) {
  const d = new THREE.Mesh(new THREE.CircleGeometry(r, 20), mGlow);
  d.rotation.x = Math.PI / 2;
  d.position.set(x, WH - 0.02, z);
  world.add(d);
}

function tvOn(x, y, z, w, h, ry) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; world.add(g);
  const tv = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), mTV);
  g.add(tv);
  return g;
}

/* ---- Living room ---- */
{
  // 120" screen on the north wall of the living room
  box(2.72, 1.6, 0.06, mBlack, -1.7, 1.62, 0.62);
  plane(2.56, 1.44, mScreen, -1.7, 1.62, 0.66);
  box(0.5, 2.4, 0.08, mWoodD, -0.1, 1.35, 0.63); // wood slat accent
  box(2.6, 0.42, 0.45, mWhite, -1.6, 0.22, 0.95); // console
  box(0.45, 0.16, 0.3, mBlack, -1.2, 0.58, 0.95); // projector
  sofa(3.1, -1.4, 4.25, Math.PI);
  sofa(2.2, 1.9, 2.3, -Math.PI / 2);
  plane(3.6, 2.6, mRug, -1.0, 0.03, 2.75, -Math.PI / 2);
  // coffee table
  cyl(0.5, 0.5, 0.05, mOak, -1.3, 0.42, 2.7, 24);
  cyl(0.03, 0.03, 0.4, mGold, -1.55, 0.2, 2.55, 8);
  cyl(0.03, 0.03, 0.4, mGold, -1.05, 0.2, 2.55, 8);
  cyl(0.03, 0.03, 0.4, mGold, -1.3, 0.2, 2.9, 8);
  // plant
  cyl(0.18, 0.14, 0.4, mWhite, -2.8, 0.2, 1.1, 12);
  const leaf1 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mLeaf);
  leaf1.position.set(-2.8, 0.72, 1.1); leaf1.scale.y = 1.4; leaf1.castShadow = true; world.add(leaf1);
  // air purifier
  cyl(0.17, 0.17, 0.6, mWhite, -2.85, 0.3, 4.5, 16);
  // gold semi-flush ceiling light
  cyl(0.02, 0.02, 0.18, mGold, 1.6, WH - 0.1, 2.9, 8);
  const cf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), mGlow); cf.position.set(1.6, WH - 0.22, 2.9); world.add(cf);
  ceilLight(-1.5, 2.8, 0.14);
}

/* ---- Kitchen ---- */
{
  const runBase = (x1, x2, z) => {
    box(x2 - x1, 0.86, 0.6, mWhite, (x1 + x2) / 2, 0.43, z);
    box(x2 - x1 + 0.04, 0.05, 0.66, M(0xfafaf7, 0.35), (x1 + x2) / 2, 0.885, z);
  };
  const runUpper = (x1, x2, z) => box(x2 - x1, 0.78, 0.34, mWhite, (x1 + x2) / 2, 1.98, z);
  runBase(-7.85, -4.4, 2.66);   // north row (stops before fridge)
  runBase(-7.85, -3.45, 4.62);  // south row
  runUpper(-7.85, -4.6, 2.53);
  runUpper(-7.85, -3.45, 4.75);
  // gold handles
  for (let x = -7.6; x < -4.6; x += 0.55) {
    box(0.03, 0.14, 0.03, mGold, x, 0.62, 2.35);
    box(0.03, 0.14, 0.03, mGold, x, 0.62, 4.93);
    box(0.03, 0.14, 0.03, mGold, x, 1.75, 2.35);
    box(0.03, 0.14, 0.03, mGold, x, 1.75, 4.94);
  }
  // fridge (north row, next to the laundry door)
  box(0.85, 1.82, 0.72, mSteel, -3.95, 0.91, 2.72);
  box(0.02, 1.2, 0.04, mSteel, -3.95, 1.1, 3.09);
  // stove + microwave (south row)
  box(0.76, 0.86, 0.62, mSteel, -5.6, 0.43, 4.62);
  box(0.76, 0.02, 0.56, mBlack, -5.6, 0.9, 4.62);
  box(0.7, 0.36, 0.34, mSteel, -5.6, 1.62, 4.76);
  // sink + gold faucet (north row)
  box(0.6, 0.03, 0.42, M(0x9aa0a6, 0.4, 0.7), -4.9, 0.9, 2.66);
  cyl(0.02, 0.02, 0.3, mGold, -5.05, 1.05, 2.6, 8);
  cyl(0.018, 0.018, 0.24, mGold, -4.98, 1.2, 2.66, 8).rotation.z = Math.PI / 2.3;
  // gold chandelier
  const ch = new THREE.Group(); ch.position.set(-5.6, WH - 0.3, 3.6); world.add(ch);
  box(0.7, 0.03, 0.03, mGold, 0, 0, 0, 0, ch);
  box(0.03, 0.03, 0.7, mGold, 0, 0, 0, 0, ch);
  for (const [bx, bz] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) {
    const bb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), mBulb);
    bb.position.set(bx, 0, bz); ch.add(bb);
  }
  ceilLight(-5.6, 3.6, 0.12);
}

/* ---- Laundry ---- */
{
  box(0.68, 1.05, 0.68, mSteel, -7.5, 0.53, 1.15);
  box(0.68, 1.05, 0.68, mSteel, -7.5, 0.53, 1.9);
  box(0.5, 0.06, 0.5, mBlack, -7.5, 1.08, 1.15);
  cyl(0.24, 0.24, 0.02, mBlack, -7.5, 1.06, 1.9, 18);
  cyl(0.28, 0.28, 1.2, M(0xd8d6d2, 0.6), -7.55, 0.85, 0.75, 16); // water heater
  box(1.1, 2.1, 0.5, mWhite, -3.85, 1.05, 1.9);  // tall cabinets
  box(1.1, 0.7, 0.4, mWhite, -3.85, 2.0, 0.9);
  box(0.03, 0.16, 0.03, mGold, -4.1, 1.3, 2.16);
  box(0.03, 0.16, 0.03, mGold, -3.6, 1.3, 2.16);
  ceilLight(-6.0, 1.4, 0.12);
}

/* ---- Bunk room (Bedroom 3) ---- */
{
  const g = new THREE.Group(); g.position.set(-5.35, 0, -3.55); world.add(g);
  const b = (bw, bh, bd, bx, by, bz) => box(bw, bh, bd, mWhite, bx, by, bz, 0, g);
  // posts
  for (const [px, pz] of [[-0.48, -1.02], [0.48, -1.02], [-0.48, 1.02], [0.48, 1.02]])
    b(0.09, 1.85, 0.09, px, 0.93, pz);
  b(1.02, 0.16, 2.1, 0, 0.42, 0);           // lower platform
  b(1.02, 0.16, 2.1, 0, 1.42, 0);           // upper platform
  box(0.96, 0.14, 2.0, mLinen, 0, 0.56, 0, 0, g);
  box(0.96, 0.14, 2.0, mLinen, 0, 1.56, 0, 0, g);
  b(1.02, 0.22, 0.05, 0, 1.78, -1.0);       // guard rails
  b(1.02, 0.22, 0.05, 0, 1.78, 1.0);
  b(0.05, 0.22, 2.1, -0.51, 1.78, 0);
  b(0.98, 0.28, 1.9, 0, 0.14, 0.06);        // trundle drawer
  b(0.05, 0.05, 0.05, 0.3, 0.6, -0.9);
  // ladder at the north end
  for (let i = 0; i < 4; i++) b(0.4, 0.05, 0.05, -0.75, 0.35 + i * 0.36, -0.9);
  b(0.05, 1.5, 0.05, -0.95, 0.8, -0.9);
  b(0.05, 1.5, 0.05, -0.55, 0.8, -0.9);
  tvOn(-7.88, 1.7, -3.0, 1.1, 0.65, Math.PI / 2);
  plane(1.8, 2.6, mRugGray, -6.6, 0.035, -3.0, -Math.PI / 2);
  fan(-6.4, -3.1);
}

/* ---- Bedroom 2 ---- */
{
  plane(3.75, 0.02, mWallTan, 0, 0, 0).visible = false; // (placeholder no-op)
  // tan accent wall (west side)
  box(0.02, WH - 0.05, 3.75, mWallTan, -4.58, WH / 2, -3.1);
  bedQ(-2.6, -3.6, mOak, mTanTh, 1.0);
  nightstand(-3.5, -4.5, mOak);
  nightstand(-1.7, -4.5, mOak);
  // three art frames
  for (let i = -1; i <= 1; i++) box(0.42, 0.56, 0.03, mOak, -2.6 + i * 0.55, 2.05, -4.87);
  plane(2.6, 1.9, mRugGray, -2.6, 0.035, -3.1, -Math.PI / 2);
  fan(-2.6, -3.1);
}

/* ---- Master bedroom ---- */
{
  bedQ(3.2, -3.6, mWhite, M(0xd8b58a, 1), 1.2);
  nightstand(2.2, -4.5);
  nightstand(4.2, -4.5);
  box(1.2, 0.5, 0.03, mGold, 3.2, 2.1, -4.87); // art
  box(1.3, 1.05, 0.5, mWhite, -0.1, 0.53, -3.1); // dresser
  box(0.03, 0.14, 0.03, mGold, 0.15, 0.6, -2.83);
  box(0.03, 0.14, 0.03, mGold, 0.15, 0.35, -2.83);
  tvOn(2.6, 1.55, -1.32, 1.25, 0.72, Math.PI);
  plane(2.8, 2.0, mRug, 3.2, 0.035, -3.0, -Math.PI / 2);
  fan(3.2, -3.1);
  ceilLight(1.0, -3.0, 0.1);
}

/* ---- Full bathroom (hall) ---- */
{
  box(1.3, 0.82, 0.55, mWhite, 5.0, 0.41, -0.88);
  box(1.36, 0.05, 0.6, M(0xfafaf7, 0.3), 5.0, 0.86, -0.88);
  plane(1.1, 0.9, M(0xdfe8ea, 0.1, 0.8), 5.0, 1.65, -1.1);
  cyl(0.02, 0.02, 0.22, mSteel, 5.0, 0.98, -0.8, 8);
  // toilet
  box(0.4, 0.55, 0.2, mWhite, 6.68, 0.55, -0.3);
  cyl(0.21, 0.24, 0.4, mWhite, 6.48, 0.25, -0.3, 16);
  // corner shower with glass
  box(1.0, 0.08, 1.0, mWhite, 6.35, 0.06, 0.15);
  plane(1.0, 2.1, mGlass, 5.85, 1.1, 0.15, 0, Math.PI / 2);
  plane(1.0, 2.1, mGlass, 6.35, 1.1, -0.35, 0, 0);
  cyl(0.015, 0.015, 0.3, mSteel, 6.6, 2.05, 0.35, 8).rotation.z = Math.PI / 2;
  cyl(0.07, 0.07, 0.015, mSteel, 6.45, 2.0, 0.35, 12);
  // towels
  box(0.5, 0.35, 0.04, mWhite, 6.95, 1.5, -0.3, Math.PI / 2);
  ceilLight(5.2, -0.35, 0.12);
}

/* ---- Master bathroom (ensuite) ---- */
{
  // marble feature walls
  plane(2.1, WH - 0.1, mMarble, 6.86, WH / 2, -3.9, 0, -Math.PI / 2);
  plane(2.3, WH - 0.1, mMarble, 5.8, WH / 2, -4.86, 0, 0);
  // walk-in shower: tray, front glass with gold rail, rainfall head
  box(1.34, 0.09, 1.3, mWhite, 6.3, 0.05, -4.28);
  plane(1.35, 2.08, mGlass, 6.3, 1.1, -3.62, 0, 0);
  box(1.38, 0.05, 0.05, mGold, 6.3, 2.16, -3.62);
  box(0.05, 2.08, 0.05, mGold, 5.62, 1.1, -3.62);
  box(0.26, 0.025, 0.26, mGold, 6.3, 2.32, -4.3);
  const arm = cyl(0.016, 0.016, 0.5, mGold, 6.3, 2.33, -4.55, 8);
  arm.rotation.x = Math.PI / 2;
  cyl(0.013, 0.013, 0.65, mGold, 6.84, 1.45, -4.05, 8);
  cyl(0.06, 0.06, 0.02, mGold, 6.84, 1.15, -4.05, 12).rotation.z = Math.PI / 2;
  // gold-framed niche in the marble
  box(0.54, 0.4, 0.03, mGold, 6.55, 1.55, -4.84);
  box(0.46, 0.32, 0.03, M(0xf5f2ea, 0.6), 6.55, 1.55, -4.825);
  // vanity
  box(1.1, 0.84, 0.5, mWhite, 5.35, 0.42, -3.05);
  plane(0.9, 0.8, M(0xdfe8ea, 0.1, 0.8), 5.35, 1.6, -2.86);
  cyl(0.018, 0.018, 0.26, mGold, 5.35, 0.98, -3.0, 8);
  // gold towel bar + towel
  cyl(0.015, 0.015, 0.6, mGold, 4.72, 1.6, -3.4, 8).rotation.x = Math.PI / 2;
  box(0.05, 0.55, 0.5, mWhite, 4.74, 1.3, -3.4);
  ceilLight(5.7, -3.8, 0.12);
}

/* ---- Hallway ---- */
{
  box(1.2, 0.75, 0.32, mOak, -1.5, 0.38, -1.0);
  box(0.5, 0.6, 0.03, mGold, -1.5, 1.7, -1.16);
  plane(4.6, 1.0, mRugGray, -1.3, 0.03, -0.35, -Math.PI / 2);
  ceilLight(-1.0, -0.35, 0.1);
  ceilLight(-5.0, -0.35, 0.1);
}

/* ------------------------------------------------------------
   Backyard oasis
   ------------------------------------------------------------ */
const bulbs = [];
function stringLights(p1, p2, count) {
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mBulb);
    b.position.set(lerp(p1.x, p2.x, t), lerp(p1.y, p2.y, t) - Math.sin(t * Math.PI) * 0.22, lerp(p1.z, p2.z, t));
    world.add(b); bulbs.push(b);
  }
}

{
  // fence
  const fh = 1.85;
  box(0.12, fh, 8.8, mFence, -8.66, fh / 2, -9.5);
  box(0.12, fh, 8.8, mFence, 8.66, fh / 2, -9.5);
  box(17.4, fh, 0.12, mFence, 0, fh / 2, -13.84);
  box(0.12, fh, 4.2, mFence, 8.66, fh / 2, 3.2); // side yard front piece
  for (let i = 0; i < 5; i++) stringLights(V3(-8.6 + i * 3.45, 1.95, -13.7), V3(-8.6 + (i + 1) * 3.45, 1.95, -13.7), 5);
  stringLights(V3(-8.55, 1.95, -6.0), V3(-8.55, 1.95, -13.6), 8);
  stringLights(V3(8.55, 1.95, -6.0), V3(8.55, 1.95, -13.6), 8);

  // covered patio (attached, west side)
  box(0.16, 2.5, 0.16, mWhite, -7.6, 1.25, -8.1);
  box(0.16, 2.5, 0.16, mWhite, -2.4, 1.25, -8.1);
  box(5.9, 0.14, 3.1, M(0xf3f1ec, 0.85), -5.0, 2.56, -6.75);
  // grill
  box(0.85, 0.45, 0.5, mBlack, -4.4, 0.85, -7.4);
  box(0.85, 0.2, 0.44, M(0x2e3134, 0.4, 0.4), -4.4, 1.17, -7.42);
  cyl(0.02, 0.02, 0.6, mBlack, -4.7, 0.35, -7.25, 8);
  cyl(0.02, 0.02, 0.6, mBlack, -4.1, 0.35, -7.25, 8);
  // wicker seating + storage box
  box(1.5, 0.55, 0.65, mWoodD, -6.6, 0.28, -6.4);
  box(0.6, 0.5, 0.6, M(0x3f4c72, 0.9), -5.9, 0.55, -7.5);
  box(0.6, 0.5, 0.6, M(0x3f4c72, 0.9), -6.7, 0.55, -7.4);

  // spa
  cyl(1.2, 1.25, 0.82, M(0x6d7378, 0.85), 3.9, 0.41, -6.9, 24);
  cyl(1.05, 1.05, 0.06, mWater, 3.9, 0.8, -6.9, 24);
  box(0.8, 0.22, 0.5, mWoodW, 2.7, 0.11, -6.9);
  box(0.8, 0.22, 0.5, mWoodW, 2.85, 0.33, -6.9);

  // putting green
  const shape = new THREE.Shape();
  const gw = 4.8, gh = 2.4, r = 1.0;
  shape.moveTo(-gw / 2 + r, -gh / 2);
  shape.lineTo(gw / 2 - r, -gh / 2); shape.quadraticCurveTo(gw / 2, -gh / 2, gw / 2, -gh / 2 + r);
  shape.lineTo(gw / 2, gh / 2 - r); shape.quadraticCurveTo(gw / 2, gh / 2, gw / 2 - r, gh / 2);
  shape.lineTo(-gw / 2 + r, gh / 2); shape.quadraticCurveTo(-gw / 2, gh / 2, -gw / 2, gh / 2 - r);
  shape.lineTo(-gw / 2, -gh / 2 + r); shape.quadraticCurveTo(-gw / 2, -gh / 2, -gw / 2 + r, -gh / 2);
  const fringe = new THREE.Mesh(new THREE.ShapeGeometry(shape), M(0x2f8f2f, 1));
  fringe.rotation.x = -Math.PI / 2; fringe.scale.set(1.1, 1.1, 1); fringe.position.set(3.6, 0.04, -10.6);
  fringe.receiveShadow = true; world.add(fringe);
  const green = new THREE.Mesh(new THREE.ShapeGeometry(shape), M(0x46c93c, 1));
  green.rotation.x = -Math.PI / 2; green.position.set(3.6, 0.055, -10.6);
  green.receiveShadow = true; world.add(green);
  for (const [fx, fz] of [[2.2, -11.2], [4.9, -10.1], [4.4, -11.3]]) {
    cyl(0.05, 0.05, 0.015, mWhite, fx, 0.06, fz, 10);
    cyl(0.012, 0.012, 0.9, mWhite, fx, 0.5, fz, 6);
    const flag = box(0.24, 0.15, 0.01, M(0xd83a3a, 0.8), fx + 0.13, 0.85, fz);
    flag.castShadow = false;
  }

  // pergola bar
  const pg = new THREE.Group(); pg.position.set(2.6, 0, -12.6); world.add(pg);
  for (const [px, pz] of [[-1.8, -0.65], [1.8, -0.65], [-1.8, 0.65], [1.8, 0.65]])
    box(0.13, 2.4, 0.13, mWoodW, px, 1.2, pz, 0, pg);
  box(4.1, 0.1, 0.16, mWoodW, 0, 2.42, -0.65, 0, pg);
  box(4.1, 0.1, 0.16, mWoodW, 0, 2.42, 0.65, 0, pg);
  for (let i = -2; i <= 2; i++) box(0.1, 0.08, 1.7, mWoodW, i * 0.85, 2.5, 0, 0, pg);
  box(3.6, 1.05, 0.85, mWoodW, 0, 0.53, -0.15, 0, pg);
  box(3.8, 0.07, 1.0, mOak, 0, 1.09, -0.1, 0, pg);
  for (let i = -1; i <= 2; i++) {
    cyl(0.17, 0.17, 0.06, mWoodD, i * 0.95 - 0.4, 0.66, 0.75, 12, pg);
    cyl(0.03, 0.03, 0.64, mWoodD, i * 0.95 - 0.4, 0.32, 0.75, 8, pg);
  }
  stringLights(V3(0.8, 2.4, -13.25), V3(4.4, 2.4, -13.25), 6);
  const barGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.8), new THREE.MeshBasicMaterial({ color: 0xffc97a, transparent: true, opacity: 0.28 }));
  barGlow.position.set(2.6, 0.8, -12.0); world.add(barGlow);

  // hanging egg chair
  {
    const eg = new THREE.Group(); eg.position.set(7.3, 0, -12.3); eg.rotation.y = -2.2; world.add(eg);
    cyl(0.5, 0.55, 0.06, mSteel, 0, 0.03, 0, 20, eg);
    cyl(0.035, 0.035, 2.15, mSteel, 0, 1.1, 0, 10, eg);
    const arm = cyl(0.03, 0.03, 0.75, mSteel, 0.3, 2.12, 0, 8, eg);
    arm.rotation.z = -1.1;
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, 20, 14, Math.PI * 0.62, Math.PI * 1.42, Math.PI * 0.12, Math.PI * 0.78),
      new THREE.MeshStandardMaterial({ color: 0xd9cfba, roughness: 0.92, side: THREE.DoubleSide }));
    shell.position.set(0.62, 1.15, 0); shell.rotation.y = Math.PI / 2; shell.castShadow = true;
    eg.add(shell);
    const cush = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), mCream);
    cush.scale.set(1, 0.45, 1); cush.position.set(0.62, 0.85, 0);
    eg.add(cush);
  }

  // pickleball practice net
  box(0.05, 1.0, 0.05, mBlack, -3.4, 0.5, -13.3);
  box(0.05, 1.0, 0.05, mBlack, -0.8, 0.5, -13.3);
  box(2.65, 0.05, 0.05, mBlack, -2.1, 1.0, -13.3);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.85),
    new THREE.MeshStandardMaterial({ color: 0x222222, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  net.position.set(-2.1, 0.55, -13.3); world.add(net);
  box(2.6, 0.06, 0.02, mWhite, -2.1, 0.98, -13.29);
}

/* ------------------------------------------------------------
   Front yard
   ------------------------------------------------------------ */
function palm(x, z, h = 2.8, lean = 0.12) {
  const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
  const trunk = cyl(0.08, 0.14, h, mTrunk, 0, h / 2, 0, 8, g);
  trunk.rotation.z = lean;
  const top = V3(Math.sin(lean) * -h, h * Math.cos(lean), 0);
  for (let i = 0; i < 8; i++) {
    const fr = box(1.25, 0.02, 0.26, mLeaf, 0, 0, 0, 0, g);
    const a = i * Math.PI / 4;
    fr.position.set(top.x + Math.cos(a) * 0.55, top.y - 0.12, top.z + Math.sin(a) * 0.55);
    fr.rotation.set(0, -a, 0.35, 'YXZ');
  }
}
palm(-4.6, 7.4, 3.0, 0.1);
palm(-3.6, 6.8, 2.2, -0.14);
palm(6.5, -12.8, 3.2, 0.1);
palm(-7.8, -12.6, 2.6, -0.1);
for (let i = 0; i < 5; i++) {
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), mLeaf);
  bush.position.set(-6.8 + i * 1.1, 0.24, 5.75);
  bush.scale.y = 0.75; bush.castShadow = true; world.add(bush);
}

/* Clouds */
const clouds = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random() * 1.6, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 }));
    p.position.set(k * 2.2 - 2, Math.random() * 0.6, Math.random() * 1.4);
    p.scale.y = 0.45;
    g.add(p);
  }
  g.position.set(-30 + i * 18, 17 + i * 2.4, -14 + i * 9);
  scene.add(g); clouds.push(g);
}

/* ------------------------------------------------------------
   Lights
   ------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0xfff6e8, 0xb8b0a0, 0.65));
const sun = new THREE.DirectionalLight(0xffe2b0, 2.0);
sun.position.set(9, 30, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
sun.shadow.bias = -0.0004;
scene.add(sun);

/* ------------------------------------------------------------
   Camera control + guided transitions
   ------------------------------------------------------------ */
let cur = 0;
let mode = 'idle';
let yaw = 0, pitch = 0, yawT = 0, pitchT = 0;
let cancelTween = null;
let autoTimer = null;
let autoplay = false;

function setAnglesFrom(pos, look) {
  const d = look.clone().sub(pos);
  yaw = yawT = Math.atan2(d.x, d.z);
  pitch = pitchT = Math.asin(clamp(d.y / d.length(), -1, 1));
}

camera.position.copy(stops[0].pos);
setAnglesFrom(stops[0].pos, stops[0].look);

function tweenVal(dur, onU, onC) {
  let dead = false;
  const start = performance.now();
  function frame(now) {
    if (dead) return;
    const p = clamp((now - start) / dur, 0, 1);
    onU(easeInOutCubic(p), p);
    if (p < 1) requestAnimationFrame(frame);
    else if (onC) onC();
  }
  requestAnimationFrame(frame);
  return () => { dead = true; };
}

function between(i, j) {
  const pts = [];
  if (j > i) {
    for (let k = i; k < j; k++) {
      pts.push(...segs[k]);
      if (k + 1 < j) pts.push(stops[k + 1].pos);
    }
  } else {
    for (let k = i - 1; k >= j; k--) {
      pts.push(...[...segs[k]].reverse());
      if (k > j) pts.push(stops[k].pos);
    }
  }
  return pts;
}

function scheduleAuto() {
  clearTimeout(autoTimer);
  if (!autoplay) return;
  autoTimer = setTimeout(() => goTo((cur + 1) % stops.length), 4300);
}

function goTo(j, instant = false) {
  if (j === cur && mode === 'idle' && !instant) { scheduleAuto(); return; }
  clearTimeout(autoTimer);
  if (cancelTween) cancelTween();
  updateUI(j);

  if (reduced || instant) {
    const fadeEl = document.getElementById('fade');
    fadeEl.classList.add('show');
    setTimeout(() => {
      camera.position.copy(stops[j].pos);
      setAnglesFrom(stops[j].pos, stops[j].look);
      cur = j; mode = 'idle';
      fadeEl.classList.remove('show');
      scheduleAuto();
    }, reduced ? 200 : 420);
    return;
  }

  mode = 'move';
  const raw = [camera.position.clone(), ...between(cur, j), stops[j].pos.clone()];
  const pts = raw.filter((p, i) => i === 0 || p.distanceTo(raw[i - 1]) > 0.05);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const len = curve.getLength();
  const dur = clamp(len * 380, 1500, 9500);
  const startLook = camera.position.clone().add(V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(3));
  const finalLook = stops[j].look;
  const pos = new THREE.Vector3(), aim = new THREE.Vector3();

  cancelTween = tweenVal(dur, (e) => {
    curve.getPointAt(e, pos);
    curve.getPointAt(Math.min(1, e + 0.045), aim);
    const a1 = smoothstep(0, 0.14, e);
    aim.lerpVectors(startLook, aim, a1);
    const a2 = smoothstep(0.7, 1, e);
    aim.lerp(finalLook, a2);
    camera.position.copy(pos);
    camera.lookAt(aim);
  }, () => {
    cur = j; mode = 'idle';
    setAnglesFrom(stops[j].pos, finalLook);
    cancelTween = null;
    scheduleAuto();
  });
}

/* Drag look-around */
{
  let dragging = false, px = 0, py = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; px = e.clientX; py = e.clientY;
    canvas.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
    document.getElementById('tourHint').classList.add('gone');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || mode !== 'idle') return;
    yawT += (e.clientX - px) * 0.0034;
    pitchT = clamp(pitchT + (e.clientY - py) * 0.0026, -0.6, 0.6);
    px = e.clientX; py = e.clientY;
  });
  const up = () => { dragging = false; canvas.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
}

addEventListener('keydown', (e) => {
  if (/input|textarea|select/i.test(document.activeElement?.tagName || '')) return;
  if (e.key === 'ArrowRight') goTo(Math.min(stops.length - 1, cur + 1));
  if (e.key === 'ArrowLeft') goTo(Math.max(0, cur - 1));
});

/* ------------------------------------------------------------
   UI
   ------------------------------------------------------------ */
const chipsEl = document.getElementById('chips');
const cardEl = document.getElementById('tourCard');
const nameEl = document.getElementById('roomName');
const descEl = document.getElementById('roomDesc');
const idxEl = document.getElementById('roomIdx');
const progEl = document.getElementById('tourProgress');

stops.forEach((s, i) => {
  const b = document.createElement('button');
  b.className = 'chip' + (i === 0 ? ' active' : '');
  b.textContent = s.label;
  b.setAttribute('role', 'tab');
  b.addEventListener('click', () => goTo(i));
  chipsEl.appendChild(b);
});

function updateUI(j) {
  cardEl.classList.add('swap');
  setTimeout(() => {
    idxEl.textContent = `${String(j + 1).padStart(2, '0')} / ${String(stops.length).padStart(2, '0')}`;
    nameEl.textContent = stops[j].name;
    descEl.textContent = stops[j].desc;
    cardEl.classList.remove('swap');
  }, 260);
  [...chipsEl.children].forEach((c, i) => c.classList.toggle('active', i === j));
  const chip = chipsEl.children[j];
  if (chip) chipsEl.scrollTo({ left: chip.offsetLeft - (chipsEl.clientWidth - chip.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
  progEl.style.width = `${((j + 1) / stops.length) * 100}%`;
}
updateUI(0);
descEl.textContent = stops[0].desc;

document.getElementById('prevBtn').addEventListener('click', () => goTo(Math.max(0, cur - 1)));
document.getElementById('nextBtn').addEventListener('click', () => goTo(Math.min(stops.length - 1, cur + 1)));

const autoBtn = document.getElementById('autoBtn');
autoBtn.addEventListener('click', () => {
  autoplay = !autoplay;
  autoBtn.classList.toggle('playing', autoplay);
  autoBtn.setAttribute('aria-label', autoplay ? 'Pause automatic tour' : 'Play automatic tour');
  if (autoplay && mode === 'idle') goTo((cur + 1) % stops.length);
  else if (!autoplay) clearTimeout(autoTimer);
});

/* Room cards */
const roomsGrid = document.getElementById('roomsGrid');
stops.forEach((s, i) => {
  const card = document.createElement('article');
  card.className = 'room-card reveal';
  card.innerHTML = `
    <span class="num">${String(i + 1).padStart(2, '0')}</span>
    <h3>${s.name}</h3>
    <p>${s.desc}</p>
    <button class="visit" data-stop="${i}">
      Step inside
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </button>`;
  roomsGrid.appendChild(card);
});
roomsGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.visit');
  if (!btn) return;
  const i = +btn.dataset.stop;
  document.getElementById('tour').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  setTimeout(() => goTo(i), reduced ? 120 : 650);
});

/* Reveal on scroll */
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
}, { threshold: 0.14 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* Nav state */
const navEl = document.getElementById('nav');
const tourEl = document.getElementById('tour');
function onScroll() {
  navEl.classList.toggle('solid', scrollY > 40);
  const r = tourEl.getBoundingClientRect();
  navEl.classList.toggle('on-dark', r.top < 70 && r.bottom > 70);
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* Render only while the tour is on screen */
let tourVisible = true;
new IntersectionObserver((en) => { tourVisible = en[0].isIntersecting; }, { threshold: 0 }).observe(tourEl);

/* ------------------------------------------------------------
   Loop
   ------------------------------------------------------------ */
const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  if (!tourVisible && elapsed > 3) return;

  fans.forEach((f) => { f.rotation.y += dt * 3.4; });
  clouds.forEach((c, i) => {
    c.position.x += dt * (0.25 + i * 0.06);
    if (c.position.x > 42) c.position.x = -46;
  });
  mBulb.color.setHSL(0.1, 0.75, 0.62 + Math.sin(elapsed * 2.2) * 0.06);

  if (mode === 'idle') {
    const k = 1 - Math.pow(0.0008, dt);
    yaw += (yawT - yaw) * k;
    pitch += (pitchT - pitch) * k;
    const swayY = reduced ? 0 : Math.sin(elapsed * 0.5) * 0.006;
    const swayP = reduced ? 0 : Math.cos(elapsed * 0.4) * 0.004;
    const ey = yaw + swayY, ep = pitch + swayP;
    const dir = V3(Math.sin(ey) * Math.cos(ep), Math.sin(ep), Math.cos(ey) * Math.cos(ep));
    camera.lookAt(camera.position.clone().add(dir));
  }

  renderer.render(scene, camera);
}

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
sizeRenderer();
animate();

{
  const loader = document.getElementById('loader');
  const fill = document.getElementById('loaderFill');
  let p = 0;
  const tick = setInterval(() => {
    p = Math.min(100, p + 9 + Math.random() * 14);
    fill.style.width = p + '%';
    if (p >= 100) {
      clearInterval(tick);
      setTimeout(() => {
        loader.classList.add('done');
        document.body.classList.add('ready');
      }, 250);
    }
  }, 90);
}
