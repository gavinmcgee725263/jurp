/* Villa Vermiglia — dusk scene & guided walkthrough camera.
   Procedural modernist villa in the Serra hills, Three.js. */

import * as THREE from "three";

/* ---------- palette (scene-side, matches the CSS dusk) ---------- */
const C = {
  zenith: new THREE.Color(0x14112a),
  horizon: new THREE.Color(0x452a44),
  sunGlow: new THREE.Color(0xff6b35),
  fog: new THREE.Color(0x241c38),
  ground: new THREE.Color(0x1d1721),
  hillNear: new THREE.Color(0x211a2c),
  hillFar: new THREE.Color(0x352b4b),
  travertine: new THREE.Color(0xd9cdb8),
  travertineDark: new THREE.Color(0xb8ab94),
  oak: new THREE.Color(0x4a3527),
  bronze: new THREE.Color(0x6e5638),
  glass: new THREE.Color(0xa8c0d0),
  warmLight: new THREE.Color(0xffc48f),
  water: new THREE.Color(0x0e2e33),
  cypress: new THREE.Color(0x101a12),
  upholstery: new THREE.Color(0x7a6f63),
  linen: new THREE.Color(0xcfc4b0),
};

/* Camera viewpoints — order matches ROOMS in main.js */
const VIEWPOINTS = [
  { pos: [27, 2.4, 25], target: [-2, 4.5, -2] },        // Arrival
  { pos: [-2.2, 2.0, 4.6], target: [-9, 1.0, -20] },    // Great Room
  { pos: [10, 1.9, 4.8], target: [0, 1.1, -16] },       // Kitchen & Dining
  { pos: [-12.6, 6.15, 1.2], target: [-2, 5.0, -16] },  // Primary Suite
  { pos: [8.6, 6.1, 2.2], target: [2, 5.3, -18] },      // The Study
  { pos: [11.5, 3.4, -27.5], target: [-1, 4.6, 6] },    // Terrace & Pool
];

/* Wider vista used behind the hero, before the tour begins */
const VISTA = { pos: [40, 7, 40], target: [-4, 4, -6] };
const VISTA_B = { pos: [34, 5.2, 33], target: [-3, 4.2, -5] }; // hero scroll dolly end

const box = (w, h, d, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

export function initScene(canvas, { reducedMotion = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    return { ok: false };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C.fog, 0.0022);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.3, 3000);

  /* ---------- sky dome ---------- */
  const sunDir = new THREE.Vector3(-0.18, 0.045, -1).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: C.zenith },
      horizon: { value: C.horizon },
      sunGlow: { value: C.sunGlow },
      sunDir: { value: sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 zenith, horizon, sunGlow, sunDir;
      void main() {
        float h = vDir.y;
        vec3 col = mix(horizon, zenith, smoothstep(-0.02, 0.42, h));
        float sunAmt = pow(max(dot(normalize(vDir), sunDir), 0.0), 14.0);
        float belt = 1.0 - smoothstep(0.0, 0.16, abs(h - 0.03));
        col += sunGlow * (sunAmt * 0.55 + sunAmt * belt * 0.95);
        col = mix(col, zenith * 0.72, smoothstep(-0.02, -0.4, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1600, 32, 20), skyMat);
  scene.add(sky);

  /* sun disc + glow sprite */
  const sunPos = sunDir.clone().multiplyScalar(1400);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 40),
    new THREE.MeshBasicMaterial({ color: 0xffb066, fog: false })
  );
  sunDisc.position.copy(sunPos);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 128;
  const gctx = glowCanvas.getContext("2d");
  const grad = gctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,150,80,0.55)");
  grad.addColorStop(0.35, "rgba(255,110,60,0.16)");
  grad.addColorStop(1, "rgba(255,90,50,0)");
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(glowCanvas),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
  );
  glow.position.copy(sunPos);
  glow.scale.setScalar(430);
  scene.add(glow);

  /* stars */
  {
    const n = 320;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const az = Math.random() * Math.PI * 2;
      const el = 0.22 + Math.random() * 1.2;
      const r = 1500;
      positions[i * 3] = r * Math.cos(el) * Math.cos(az);
      positions[i * 3 + 1] = r * Math.sin(el);
      positions[i * 3 + 2] = r * Math.cos(el) * Math.sin(az);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xcdc6e8, size: 2.4, sizeAttenuation: false, transparent: true, opacity: 0.55, fog: false })
    );
    scene.add(stars);
  }

  /* environment reflections from the sky (glass, bronze, water) */
  {
    const envScene = new THREE.Scene();
    envScene.add(sky.clone());
    const d = sunDisc.clone();
    d.scale.setScalar(3);
    envScene.add(d);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.06).texture;
    pmrem.dispose();
  }

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0x554a80, 0x241a16, 0.8));
  const sunLight = new THREE.DirectionalLight(0xff8a4d, 0.75);
  sunLight.position.copy(sunDir.clone().multiplyScalar(120));
  scene.add(sunLight);
  // soft violet fill from the arrival side, so the shadow faces still read
  const fill = new THREE.DirectionalLight(0x8a6a8f, 0.5);
  fill.position.set(70, 45, 85);
  scene.add(fill);

  const interiorLights = [
    [-5, 3.3, 0], [8, 3.3, 0],            // ground floor
    [-8, 7.2, -1], [8, 7.2, -1],          // upper floor
  ];
  for (const [x, y, z] of interiorLights) {
    const l = new THREE.PointLight(0xffb37a, 34, 24, 2);
    l.position.set(x, y, z);
    scene.add(l);
  }
  const poolLight = new THREE.PointLight(0x5fd0c8, 10, 14, 2);
  poolLight.position.set(10, 0.6, -11.5);
  scene.add(poolLight);

  // low "lamp" fills so furniture reads from the camera side too
  const lampGreat = new THREE.PointLight(0xffc48f, 9, 11, 2);
  lampGreat.position.set(-1.5, 1.2, 2.6);
  scene.add(lampGreat);
  const lampSuite = new THREE.PointLight(0xffc48f, 8, 10, 2);
  lampSuite.position.set(-11.5, 6.4, 1.8);
  scene.add(lampSuite);

  /* ---------- materials ---------- */
  const M = {
    travertine: new THREE.MeshStandardMaterial({ color: C.travertine, roughness: 0.85 }),
    travertineDark: new THREE.MeshStandardMaterial({ color: C.travertineDark, roughness: 0.9 }),
    oak: new THREE.MeshStandardMaterial({ color: C.oak, roughness: 0.65 }),
    bronze: new THREE.MeshStandardMaterial({ color: C.bronze, roughness: 0.32, metalness: 0.9 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: C.glass,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.16,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
    }),
    emissive: new THREE.MeshBasicMaterial({ color: C.warmLight }),
    cove: new THREE.MeshStandardMaterial({
      color: 0x2a1c10,
      emissive: 0xffa85e,
      emissiveIntensity: 1.1,
      roughness: 1,
    }),
    bulb: new THREE.MeshBasicMaterial({ color: 0xd8a06a }),
    ground: new THREE.MeshStandardMaterial({ color: C.ground, roughness: 1 }),
    water: new THREE.MeshPhysicalMaterial({
      color: C.water,
      roughness: 0.04,
      metalness: 0.85,
      envMapIntensity: 2.6,
    }),
    cypress: new THREE.MeshStandardMaterial({ color: C.cypress, roughness: 1 }),
    upholstery: new THREE.MeshStandardMaterial({ color: C.upholstery, roughness: 0.95 }),
    linen: new THREE.MeshStandardMaterial({ color: C.linen, roughness: 0.95 }),
  };

  /* ---------- house ---------- */
  const house = new THREE.Group();

  // plinth / terrace
  house.add(box(38, 0.5, 26, M.travertineDark, 2, -0.25, -2));
  // ground floor oak deck (interior floor)
  house.add(box(23.6, 0.12, 11.6, M.oak, 0, 0.06, 0));
  // upper slab (floor of level 2 / ceiling of level 1)
  house.add(box(26, 0.5, 13, M.travertine, 0, 4.25, -0.5));
  // upper floor volume — travertine band with ribbon glass
  house.add(box(28, 0.7, 11, M.travertine, 0, 4.85, -1));   // spandrel
  house.add(box(28, 0.7, 11, M.travertine, 0, 7.55, -1));   // fascia
  // upper interior floor
  house.add(box(27, 0.14, 10, M.oak, 0, 5.22, -1));
  // roof slab
  house.add(box(30, 0.45, 13.5, M.travertine, 0, 8.1, -1));
  // service core
  house.add(box(4.5, 8.6, 4.5, M.travertineDark, 9.8, 4.3, 3));

  // glass — ground floor (west, east, north, south)
  const g1h = 4.0;
  const glassWest = box(23.6, g1h, 0.06, M.glass, 0, g1h / 2, -5.8);
  const glassEast = box(23.6, g1h, 0.06, M.glass, 0, g1h / 2, 5.8);
  const glassSouth = box(0.06, g1h, 11.6, M.glass, -11.8, g1h / 2, 0);
  const glassNorth = box(0.06, g1h, 11.6, M.glass, 11.8, g1h / 2, 0);
  house.add(glassWest, glassEast, glassSouth, glassNorth);
  // upper ribbon glass (between spandrel and fascia)
  house.add(box(27.6, 2, 0.06, M.glass, 0, 6.2, -6.4));
  house.add(box(27.6, 2, 0.06, M.glass, 0, 6.2, 4.4));
  house.add(box(0.06, 2, 10.8, M.glass, -13.9, 6.2, -1));

  // bronze mullions, ground floor west + east faces
  for (let x = -11.8; x <= 11.8; x += 3.933) {
    house.add(box(0.09, g1h, 0.14, M.bronze, x, g1h / 2, -5.8));
    house.add(box(0.09, g1h, 0.14, M.bronze, x, g1h / 2, 5.8));
  }
  house.add(box(23.7, 0.12, 0.16, M.bronze, 0, g1h - 0.06, -5.8));
  house.add(box(23.7, 0.12, 0.16, M.bronze, 0, g1h - 0.06, 5.8));
  for (let x = -13.8; x <= 13.8; x += 3.45) {
    house.add(box(0.08, 2, 0.12, M.bronze, x, 6.2, -6.4));
  }

  // ceiling light coves (the dusk glow from inside)
  house.add(box(20, 0.06, 0.7, M.cove, 0, 3.95, -3.4));
  house.add(box(20, 0.06, 0.7, M.cove, 0, 3.95, 2.8));
  house.add(box(24, 0.06, 0.65, M.cove, 0, 7.42, -3.6));
  house.add(box(24, 0.06, 0.65, M.cove, 0, 7.42, 1.6));

  /* furniture — great room (west half) */
  const gr = new THREE.Group();
  gr.add(box(4.6, 0.55, 1.1, M.upholstery, -6, 0.45, -2.6));           // sofa seat
  gr.add(box(4.6, 0.55, 0.35, M.upholstery, -6, 0.95, -2.05));         // sofa back
  gr.add(box(1.1, 0.55, 2.6, M.upholstery, -3.35, 0.45, -1.2));        // chaise
  gr.add(box(1.8, 0.3, 1, M.oak, -6, 0.28, -4));                       // coffee table
  gr.add(box(5.5, 0.04, 3.6, M.linen, -5.8, 0.14, -2.4));              // rug
  gr.add(box(0.5, 2.2, 0.5, M.bronze, -10.5, 1.1, -4.5));              // sculpture plinth
  house.add(gr);

  /* dining + kitchen (east half) */
  const din = new THREE.Group();
  din.add(box(3.6, 0.12, 1.2, M.oak, 4.5, 0.95, -2.2));                // table top
  din.add(box(0.18, 0.9, 0.9, M.bronze, 3.2, 0.5, -2.2));              // leg
  din.add(box(0.18, 0.9, 0.9, M.bronze, 5.8, 0.5, -2.2));              // leg
  for (let i = 0; i < 4; i++) {
    din.add(box(0.55, 0.95, 0.55, M.upholstery, 3.4 + i * 0.78, 0.5, -3.1));
    din.add(box(0.55, 0.95, 0.55, M.upholstery, 3.4 + i * 0.78, 0.5, -1.3));
  }
  din.add(box(4.2, 1, 1.3, M.travertineDark, 6.2, 0.5, 2.2));          // island
  din.add(box(4.2, 0.08, 1.4, M.travertine, 6.2, 1.04, 2.2));          // counter
  house.add(din);

  /* stair beside core */
  for (let i = 0; i < 12; i++) {
    house.add(box(1.1, 0.07, 0.34, M.oak, 6.9, 0.35 * (i + 1), 4.6 - i * 0.36));
  }

  /* primary suite (upper west) */
  const suite = new THREE.Group();
  suite.add(box(2.4, 0.35, 3, M.oak, -8.5, 5.45, -1.4));               // bed platform
  suite.add(box(2.2, 0.28, 2.7, M.linen, -8.5, 5.75, -1.4));           // mattress
  suite.add(box(2.4, 1, 0.14, M.upholstery, -8.5, 6.1, 0.15));         // headboard
  suite.add(box(3.4, 0.04, 2.4, M.upholstery, -8.4, 5.32, -3));        // rug
  suite.add(box(1.4, 0.42, 0.6, M.oak, -5.6, 5.52, -3.6));             // bench
  house.add(suite);

  /* study (upper east) */
  const study = new THREE.Group();
  study.add(box(2.6, 0.1, 1.1, M.oak, 8, 6.05, -2.6));                 // desk
  study.add(box(0.12, 0.75, 1, M.bronze, 6.9, 5.67, -2.6));
  study.add(box(0.12, 0.75, 1, M.bronze, 9.1, 5.67, -2.6));
  study.add(box(0.6, 0.6, 0.6, M.upholstery, 8, 5.6, -1.5));           // chair
  study.add(box(4.5, 2.2, 0.3, M.oak, 9.5, 6.4, 3.2));                 // shelf wall
  house.add(study);

  scene.add(house);

  /* ---------- pool ---------- */
  scene.add(box(25, 0.5, 5.4, M.travertineDark, 10, -0.3, -11.5));      // shell
  const water = box(24.4, 0.1, 4.8, M.water, 10, 0.02, -11.5);
  scene.add(water);
  scene.add(box(24.4, 0.05, 0.25, M.cove, 10, -0.02, -13.85));          // infinity lip glow

  /* ---------- landscape ---------- */
  const plateau = new THREE.Mesh(new THREE.CircleGeometry(85, 48), M.ground);
  plateau.rotation.x = -Math.PI / 2;
  plateau.position.y = -0.5;
  scene.add(plateau);

  // rolling ridges, receding toward the horizon
  const mkRidge = (dist, height, colorT, seed) => {
    const geo = new THREE.PlaneGeometry(2400, 260, 96, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const t = (y + 130) / 260;
      const crest =
        Math.sin(x * 0.004 + seed) * 0.55 +
        Math.sin(x * 0.011 + seed * 2.7) * 0.3 +
        Math.sin(x * 0.027 + seed * 5.1) * 0.15;
      pos.setZ(i, (crest * 0.5 + 0.5) * height * t);
    }
    geo.computeVertexNormals();
    const col = C.hillNear.clone().lerp(C.hillFar, colorT);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 1 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, -34, -dist);
    return m;
  };
  scene.add(mkRidge(300, 52, 0.25, 1.3));
  scene.add(mkRidge(480, 78, 0.5, 3.7));
  scene.add(mkRidge(700, 110, 0.75, 6.1));
  scene.add(mkRidge(950, 150, 1, 8.9));
  // hills behind the house too (east), lower
  const back = mkRidge(260, 46, 0.35, 11.2);
  back.rotation.z = Math.PI;
  back.position.set(0, -30, 320);
  scene.add(back);

  /* city lights in the valley */
  {
    const n = 260;
    const inst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.9, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      n
    );
    const dummy = new THREE.Object3D();
    const colA = new THREE.Color(0xffb36b);
    const colB = new THREE.Color(0x9fb6ff);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const spread = Math.random();
      dummy.position.set(
        (Math.random() - 0.5) * (240 + spread * 420),
        -40 - Math.random() * 8,
        -260 - spread * 380
      );
      dummy.scale.setScalar(0.7 + Math.random() * 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, col.copy(colA).lerp(colB, Math.random() * 0.6).multiplyScalar(0.55 + Math.random() * 0.45));
    }
    scene.add(inst);
  }

  /* cypress */
  const cypressAt = (x, z, h = 6) => {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(h * 0.14, h, 7), M.cypress);
    cone.position.y = h / 2 + 0.2;
    g.add(cone);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 5), M.oak);
    trunk.position.y = 0.25;
    g.add(trunk);
    g.position.set(x, -0.05, z);
    return g;
  };
  const cypressSpots = [
    [30, 14, 7], [33, 18, 5.6], [27, 20, 6.4],           // along the arrival way
    [-26, 10, 7.5], [-30, 5, 5.8], [-24, -6, 6.8],
    [27, -21, 6.2], [-16, 22, 7], [-20, 18, 5.2],
    [16, 26, 6.6], [40, 4, 6], [-34, -14, 6.2],
  ];
  for (const [x, z, h] of cypressSpots) scene.add(cypressAt(x, z, h));

  /* low bollard lights along the approach */
  for (let i = 0; i < 5; i++) {
    const x = 17 + i * 3.4;
    const z = 12 + i * 3.1;
    scene.add(box(0.12, 0.7, 0.12, M.bronze, x, 0.35, z));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.bulb);
    bulb.position.set(x, 0.72, z);
    scene.add(bulb);
  }

  /* ---------- camera state & tour ---------- */
  const state = {
    pos: new THREE.Vector3(...VISTA.pos),
    target: new THREE.Vector3(...VISTA.target),
    look: { yaw: 0, pitch: 0 },       // eased-toward values
    lookGoal: { yaw: 0, pitch: 0 },   // set by dragging
    parallax: 0,                       // hero scroll dolly, 0..1
    atVista: true,
    running: true,
    t: 0,
  };

  const _dir = new THREE.Vector3();
  const _lookAt = new THREE.Vector3();
  const _sph = new THREE.Spherical();

  function applyCamera() {
    if (state.atVista) {
      const a = VISTA, b = VISTA_B, p = state.parallax;
      state.pos.set(
        a.pos[0] + (b.pos[0] - a.pos[0]) * p,
        a.pos[1] + (b.pos[1] - a.pos[1]) * p,
        a.pos[2] + (b.pos[2] - a.pos[2]) * p
      );
      state.target.set(
        a.target[0] + (b.target[0] - a.target[0]) * p,
        a.target[1] + (b.target[1] - a.target[1]) * p,
        a.target[2] + (b.target[2] - a.target[2]) * p
      );
    }
    camera.position.copy(state.pos);
    _dir.subVectors(state.target, state.pos);
    const dist = _dir.length();
    _sph.setFromVector3(_dir);
    _sph.theta -= state.look.yaw;
    _sph.phi = THREE.MathUtils.clamp(_sph.phi + state.look.pitch, 0.35, Math.PI - 0.35);
    _dir.setFromSpherical(_sph).setLength(dist);
    _lookAt.addVectors(state.pos, _dir);
    camera.lookAt(_lookAt);
  }

  /* ---------- render loop ---------- */
  const clock = new THREE.Clock();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    state.t += dt;

    // eased free-look plus a slow breath when idle
    const idle = reducedMotion ? 0 : Math.sin(state.t * 0.22) * 0.014;
    const k = 1 - Math.pow(0.0018, dt); // frame-rate independent damp
    state.look.yaw += (state.lookGoal.yaw + idle - state.look.yaw) * k;
    state.look.pitch += (state.lookGoal.pitch - state.look.pitch) * k;

    // pool shimmer
    water.position.y = 0.02 + (reducedMotion ? 0 : Math.sin(state.t * 1.7) * 0.012);

    applyCamera();
    renderer.render(scene, camera);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();
  applyCamera();
  frame();

  /* ---------- public api ---------- */
  const gsapRef = window.gsap;

  function flyTo(pos, target, { instant = false } = {}) {
    if (instant || reducedMotion || !gsapRef) {
      gsapRef?.killTweensOf([state.pos, state.target, state.lookGoal]);
      state.pos.set(...pos);
      state.target.set(...target);
      state.lookGoal.yaw = 0;
      state.lookGoal.pitch = 0;
      state.look.yaw = 0;
      state.look.pitch = 0;
      return;
    }
    const d = 2.05;
    const ease = "power3.inOut";
    gsapRef.to(state.pos, { x: pos[0], y: pos[1], z: pos[2], duration: d, ease, overwrite: "auto" });
    gsapRef.to(state.target, { x: target[0], y: target[1], z: target[2], duration: d, ease, overwrite: "auto" });
    gsapRef.to(state.lookGoal, { yaw: 0, pitch: 0, duration: d * 0.6, ease: "power2.out", overwrite: "auto" });
  }

  let vistaTimer = 0;

  return {
    ok: true,
    viewpointCount: VIEWPOINTS.length,
    goTo(i, opts) {
      const v = VIEWPOINTS[i];
      if (!v) return;
      window.clearTimeout(vistaTimer);
      state.atVista = false;
      flyTo(v.pos, v.target, opts);
    },
    goVista(opts = {}) {
      window.clearTimeout(vistaTimer);
      if (opts.instant || reducedMotion || !gsapRef) {
        state.atVista = true;
        state.lookGoal.yaw = state.lookGoal.pitch = 0;
        return;
      }
      // tween back to the vista, then hand control to the parallax dolly
      flyTo(VISTA.pos, VISTA.target);
      vistaTimer = window.setTimeout(() => { state.atVista = true; }, 2100);
    },
    setParallax(p) {
      state.parallax = THREE.MathUtils.clamp(p, 0, 1);
    },
    look(dxNorm, dyNorm) {
      state.lookGoal.yaw = THREE.MathUtils.clamp(state.lookGoal.yaw + dxNorm * 1.9, -0.62, 0.62);
      state.lookGoal.pitch = THREE.MathUtils.clamp(state.lookGoal.pitch + dyNorm * 1.1, -0.3, 0.34);
    },
    setRunning(on) {
      if (on === state.running) return;
      state.running = on;
      if (on) {
        clock.getDelta();
        frame();
      } else {
        cancelAnimationFrame(raf);
      }
    },
  };
}
