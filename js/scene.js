/* Fairway House — daylight scene & guided walkthrough camera.
   Procedural single-story Florida rental modeled on the listing photos.
   The backyard stop crossfades the whole scene from noon to golden dusk. */

import * as THREE from "three";

const DUSK_STOP = 7; // Terrace stop index — entering it brings the evening

/* Camera viewpoints — order matches ROOMS in main.js */
const VIEWPOINTS = [
  { pos: [9, 1.9, 20], target: [-1.5, 2, -1] },          // Curb side
  { pos: [7, 1.75, 3.8], target: [0.6, 1.2, 0.8] },      // Living room
  { pos: [0.3, 1.65, 2.5], target: [-4.6, 1.25, 2.9] },  // Kitchen
  { pos: [2.7, 1.65, -1.1], target: [6.6, 1.15, -3.3] }, // Primary bedroom
  { pos: [-4.8, 1.65, -0.9], target: [-7.3, 1.2, -3.4] },// Oak bedroom
  { pos: [-4.9, 1.6, 1.4], target: [-7.4, 1.25, 3.1] },  // Bunk room
  { pos: [-4.2, 1.6, -0.9], target: [-2.45, 1.2, -3.9] },// Spa bath
  { pos: [8.8, 3.1, -13.6], target: [-4, 0.7, -6.5] },   // Backyard (dusk)
];

const VISTA = { pos: [11.5, 3.1, 19.5], target: [-2.5, 1.7, -1] };
const VISTA_B = { pos: [9.6, 2.6, 16.8], target: [-2.2, 1.8, -1] };

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

  /* ---------- day / dusk blend ---------- */
  const DAY = {
    zenith: new THREE.Color(0x5fa8e0),
    horizon: new THREE.Color(0xe9f3f9),
    sunGlow: new THREE.Color(0xfff2d8),
    fog: new THREE.Color(0xdcedf6),
    fogDensity: 0.0035,
    sunColor: new THREE.Color(0xfff4e0),
    sunIntensity: 1.3,
    sunDir: new THREE.Vector3(0.35, 0.8, 0.45).normalize(),
    hemiSky: new THREE.Color(0xd8e8f2),
    hemiGround: new THREE.Color(0xc2b49e),
    hemiIntensity: 0.85,
    window: new THREE.Color(0xcfe8f5),
  };
  const DUSK = {
    zenith: new THREE.Color(0x231d44),
    horizon: new THREE.Color(0xc9784f),
    sunGlow: new THREE.Color(0xf28a52),
    fog: new THREE.Color(0x342a52),
    fogDensity: 0.006,
    sunColor: new THREE.Color(0xff8a4d),
    sunIntensity: 0.55,
    sunDir: new THREE.Vector3(-0.5, 0.06, -1).normalize(),
    hemiSky: new THREE.Color(0x5a4a88),
    hemiGround: new THREE.Color(0x3a2c26),
    hemiIntensity: 0.5,
    window: new THREE.Color(0x453463),
  };

  scene.fog = new THREE.FogExp2(DAY.fog.clone(), DAY.fogDensity);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.25, 2500);

  /* ---------- sky ---------- */
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: DAY.zenith.clone() },
      horizon: { value: DAY.horizon.clone() },
      sunGlow: { value: DAY.sunGlow.clone() },
      sunDir: { value: DAY.sunDir.clone() },
      duskAmt: { value: 0 },
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
      uniform float duskAmt;
      void main() {
        float h = vDir.y;
        vec3 col = mix(horizon, zenith, smoothstep(-0.02, 0.5, h));
        float tight = mix(3.0, 14.0, duskAmt);
        float sunAmt = pow(max(dot(normalize(vDir), sunDir), 0.0), tight);
        float belt = 1.0 - smoothstep(0.0, 0.16, abs(h - 0.03));
        col += sunGlow * sunAmt * (0.35 + duskAmt * (0.2 + belt * 0.9));
        col = mix(col, zenith * 0.75, smoothstep(-0.02, -0.4, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 20), skyMat));

  /* clouds — fade out at dusk */
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  const cloudPuffs = [];
  const mkCloud = (x, y, z, s) => {
    const g = new THREE.Group();
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const r = 5 + Math.random() * 6;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
      puff.position.set((Math.random() - 0.5) * 26, Math.random() * 3 - r * 0.12, (Math.random() - 0.5) * 12);
      puff.scale.y = 0.32 + Math.random() * 0.14;
      g.add(puff);
    }
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    return g;
  };
  scene.add(mkCloud(-120, 75, -160, 1.4), mkCloud(90, 88, -220, 1.9), mkCloud(30, 70, 180, 1.2), mkCloud(-200, 92, 60, 1.6));

  /* environment reflections (glass, appliances) from the day sky */
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(1200, 16, 10), skyMat.clone()));
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.05).texture;
    pmrem.dispose();
  }

  /* ---------- lights ---------- */
  const hemi = new THREE.HemisphereLight(DAY.hemiSky.clone(), DAY.hemiGround.clone(), DAY.hemiIntensity);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xfff6ea, 0.34)); // neutral warm lift so interiors stay white
  const sun = new THREE.DirectionalLight(DAY.sunColor.clone(), DAY.sunIntensity);
  sun.position.copy(DAY.sunDir).multiplyScalar(120);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xdfe8f0, 0.35);
  fill.position.set(-60, 40, 80);
  scene.add(fill);

  // warm interior lights that only matter once dusk falls
  const eveningLights = [];
  for (const [x, y, z] of [[4, 2.4, 1.5], [-2, 2.4, 2.5], [4.5, 2.4, -2.7], [-6, 2.4, -2.7], [-6, 2.4, 2.5]]) {
    const l = new THREE.PointLight(0xffb37a, 0, 12, 2);
    l.position.set(x, y, z);
    scene.add(l);
    eveningLights.push(l);
  }
  const patioLight = new THREE.PointLight(0xffb37a, 0, 16, 2);
  patioLight.position.set(4.5, 2.6, -10);
  scene.add(patioLight);
  eveningLights.push(patioLight);
  const greenLight = new THREE.PointLight(0xffc48f, 0, 14, 2);
  greenLight.position.set(-3.5, 2.4, -8.5);
  scene.add(greenLight);
  eveningLights.push(greenLight);

  /* ---------- materials ---------- */
  const M = {
    wall: new THREE.MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.95 }),
    exterior: new THREE.MeshStandardMaterial({ color: 0xd9dde0, roughness: 0.95 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x878d93, roughness: 0.9 }),
    oakFloor: new THREE.MeshStandardMaterial({ color: 0xe6d6b4, roughness: 0.65 }),
    oakWood: new THREE.MeshStandardMaterial({ color: 0xc9a878, roughness: 0.7 }),
    whiteFurn: new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.9 }),
    linen: new THREE.MeshStandardMaterial({ color: 0xefe7d8, roughness: 0.95 }),
    tan: new THREE.MeshStandardMaterial({ color: 0xd8b98e, roughness: 0.95 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.85 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a24e, roughness: 0.3, metalness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.6 }),
    marble: new THREE.MeshStandardMaterial({ color: 0xbcd6cd, roughness: 0.25 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xd6e8f0, roughness: 0.05, metalness: 0,
      transparent: true, opacity: 0.18, envMapIntensity: 1.2, side: THREE.DoubleSide,
    }),
    lawn: new THREE.MeshStandardMaterial({ color: 0x6d9c58, roughness: 1 }),
    turf: new THREE.MeshStandardMaterial({ color: 0x3f9d5a, roughness: 0.9 }),
    paver: new THREE.MeshStandardMaterial({ color: 0xe3ded4, roughness: 0.95 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 1 }),
    asphalt: new THREE.MeshStandardMaterial({ color: 0x4a4c50, roughness: 1 }),
    fence: new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.9 }),
    palmTrunk: new THREE.MeshStandardMaterial({ color: 0xa8875f, roughness: 1 }),
    palmFrond: new THREE.MeshStandardMaterial({ color: 0x3f7d4f, roughness: 1, side: THREE.DoubleSide }),
    rattan: new THREE.MeshStandardMaterial({ color: 0xd9c8a8, roughness: 0.95, side: THREE.DoubleSide }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff0d8, emissive: 0xffb36b, emissiveIntensity: 0.05, roughness: 0.6 }),
    windowGlass: new THREE.MeshBasicMaterial({ color: DAY.window.clone() }),
  };

  /* ---------- grounds ---------- */
  {
    const lawn = new THREE.Mesh(new THREE.CircleGeometry(70, 40), M.lawn);
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.02;
    scene.add(lawn);
    scene.add(box(60, 0.1, 5, M.asphalt, 0, -0.01, 13));       // street
    scene.add(box(60, 0.12, 1.4, M.concrete, 0, -0.005, 10));  // sidewalk
    scene.add(box(3.4, 0.14, 6.5, M.concrete, 6, 0, 7.6));     // driveway, two cars deep
    scene.add(box(1.2, 0.14, 5, M.concrete, 1.4, 0, 7));       // walkway
  }

  /* ---------- house shell ---------- */
  const house = new THREE.Group();
  const W = 2.75; // wall height

  // floor + ceiling
  house.add(box(16, 0.15, 9.5, M.oakFloor, 0, 0.07, -0.25));
  house.add(box(16, 0.12, 9.5, M.wall, 0, W + 0.06, -0.25));

  // perimeter walls (exterior gray reads through fog; interior faces stay light)
  house.add(box(16, W, 0.18, M.exterior, 0, W / 2, 4.5));      // front
  house.add(box(16, W, 0.18, M.exterior, 0, W / 2, -5));       // back
  house.add(box(0.18, W, 9.5, M.exterior, -8, W / 2, -0.25));  // left
  house.add(box(0.18, W, 9.5, M.exterior, 8, W / 2, -0.25));   // right

  // hip roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(11.6, 2.6, 4), M.roof);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, W + 1.4, -0.25);
  roof.scale.z = 0.62;
  house.add(roof);
  house.add(box(16.8, 0.22, 10.3, M.wall, 0, W + 0.16, -0.25)); // fascia

  // front door + windows with shutters
  house.add(box(1.1, 2.2, 0.1, M.whiteFurn, 1.4, 1.1, 4.56));
  house.add(box(0.16, 0.16, 0.06, M.brass, 1.75, 1.05, 4.64));
  const shutter = (x, z, w = 1.5) => {
    house.add(box(w, 1.3, 0.08, M.windowGlass, x, 1.55, z));
    house.add(box(0.28, 1.3, 0.06, M.dark, x - w / 2 - 0.18, 1.55, z));
    house.add(box(0.28, 1.3, 0.06, M.dark, x + w / 2 + 0.18, 1.55, z));
  };
  shutter(4.6, 4.6);        // living front window
  shutter(-2, 4.6);         // kitchen window
  shutter(-6, 4.6, 1.2);    // bunk window
  house.add(box(0.1, 1.3, 1.6, M.windowGlass, 8.06, 1.55, -1.7));   // primary side window
  house.add(box(0.06, 1.7, 0.3, M.whiteFurn, 7.95, 1.5, -0.75));    // curtain
  house.add(box(0.1, 1.3, 1.6, M.windowGlass, -8.06, 1.55, -1.7));  // oak side window
  house.add(box(0.06, 1.7, 0.3, M.whiteFurn, -7.95, 1.5, -0.75));   // curtain
  // back sliding door to patio
  house.add(box(2.2, 2.1, 0.1, M.glass, 3.5, 1.05, -5.02));
  house.add(box(0.08, 2.1, 0.14, M.dark, 2.4, 1.05, -5.02));
  house.add(box(0.08, 2.1, 0.14, M.dark, 4.6, 1.05, -5.02));

  /* interior partitions */
  house.add(box(0.14, W, 3.5, M.wall, 0.5, W / 2, 2.75));      // living | kitchen
  house.add(box(0.14, W, 4, M.wall, -4.5, W / 2, 2.5));        // kitchen | bunk
  house.add(box(5, W, 0.14, M.wall, -5.5, W / 2, 0.5));        // bunk | hall
  house.add(box(6.5, W, 0.14, M.wall, 4.75, W / 2, -0.5));     // hall | primary (door gap at x 1)
  house.add(box(5.6, W, 0.14, M.wall, -5.2, W / 2, -0.5));     // hall | oak+bath (gap at x -2.2)
  house.add(box(0.14, W, 4.5, M.wall, 2, W / 2, -2.75));       // primary | bath
  house.add(box(0.14, W, 4.5, M.wall, -4.5, W / 2, -2.75));    // bath | oak

  /* windows glow from inside: thin emissive-ish planes handled by M.windowGlass color blend */

  /* ---------- living room (front-right) ---------- */
  {
    // media wall: wood slat panel + big screen (beach scene, like the photo)
    house.add(box(0.06, 2.3, 2.4, M.oakWood, 0.6, 1.15, 2.2));
    const screenCanvas = document.createElement("canvas");
    screenCanvas.width = 256; screenCanvas.height = 144;
    const sc = screenCanvas.getContext("2d");
    const g1 = sc.createLinearGradient(0, 0, 0, 144);
    g1.addColorStop(0, "#7ec8e8"); g1.addColorStop(0.55, "#3fa8c8"); g1.addColorStop(0.58, "#2d9ab8"); g1.addColorStop(1, "#1a7a94");
    sc.fillStyle = g1; sc.fillRect(0, 0, 256, 144);
    sc.fillStyle = "#f7e9c4"; sc.beginPath(); sc.ellipse(128, 118, 90, 22, 0, 0, 7); sc.fill();
    sc.fillStyle = "#2f7d4f"; sc.beginPath(); sc.ellipse(48, 96, 16, 30, 0.3, 0, 7); sc.fill();
    const screenMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(screenCanvas) });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.45), screenMat);
    screen.rotation.y = Math.PI / 2;
    screen.position.set(0.68, 1.5, 2.2);
    house.add(screen);
    house.add(box(0.25, 0.4, 2, M.whiteFurn, 0.75, 0.2, 2.2));  // media console

    // white sectional facing the screen
    house.add(box(1, 0.5, 2.6, M.whiteFurn, 5.4, 0.42, 1.7));   // seat
    house.add(box(0.35, 0.55, 2.6, M.whiteFurn, 5.9, 0.95, 1.7)); // back
    house.add(box(1.6, 0.5, 0.95, M.whiteFurn, 4.4, 0.42, 3.3)); // chaise arm
    house.add(box(2.6, 0.04, 1.9, M.linen, 3.4, 0.12, 1.6));    // rug
    house.add(box(0.9, 0.3, 0.55, M.oakWood, 3.3, 0.26, 1.6));  // coffee table
  }

  /* ---------- kitchen (galley, center) ---------- */
  {
    house.add(box(4.6, 0.9, 0.62, M.whiteFurn, -2.2, 0.45, 4.05));  // rear run
    house.add(box(4.6, 0.06, 0.68, M.marble, -2.2, 0.93, 4.05));
    house.add(box(4.6, 0.8, 0.62, M.whiteFurn, -2.2, 2.3, 4.1));    // uppers
    house.add(box(3.6, 0.9, 0.62, M.whiteFurn, -2.2, 0.45, 1.45));  // front run
    house.add(box(3.6, 0.06, 0.68, M.marble, -2.2, 0.93, 1.45));
    house.add(box(0.75, 1.85, 0.72, M.steel, -4.05, 0.93, 1.5));    // fridge
    for (let i = 0; i < 4; i++) {
      house.add(box(0.02, 0.14, 0.02, M.brass, -3.2 + i * 0.9, 0.6, 4.38)); // pulls
    }
  }

  /* ---------- primary bedroom (back-right) ---------- */
  const fans = [];
  const mkFan = (x, z) => {
    const g = new THREE.Group();
    g.add(box(0.07, 0.25, 0.07, M.dark, 0, -0.1, 0));
    const blades = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = box(1.0, 0.02, 0.16, M.tan, 0.5, 0, 0);
      const arm = new THREE.Group();
      arm.add(b);
      arm.rotation.y = (i * Math.PI) / 2;
      blades.add(arm);
    }
    blades.position.y = -0.22;
    g.add(blades);
    g.position.set(x, W - 0.06, z);
    g.userData.blades = blades;
    fans.push(g);
    return g;
  };
  {
    house.add(box(1.7, 0.32, 2.1, M.whiteFurn, 6.6, 0.3, -2.75));   // bed platform
    house.add(box(1.55, 0.25, 1.95, M.linen, 6.6, 0.56, -2.75));    // mattress
    house.add(box(0.12, 1.1, 1.7, M.whiteFurn, 7.6, 0.9, -2.75));   // headboard
    house.add(box(0.45, 0.5, 0.45, M.whiteFurn, 6.5, 0.25, -1.35)); // nightstand
    house.add(box(0.45, 0.5, 0.45, M.whiteFurn, 6.5, 0.25, -4.15)); // nightstand
    house.add(box(1.4, 0.85, 0.5, M.whiteFurn, 3.2, 0.42, -4.5));   // dresser
    house.add(box(2.2, 0.03, 1.7, M.tan, 5, 0.12, -2.7));           // rug
    house.add(mkFan(5.2, -2.7));
  }

  /* ---------- oak bedroom (back-left) ---------- */
  {
    house.add(box(0.12, 0.55, 1.9, M.tan, -7.92, 1.5, -2.75));      // tan accent wall wash
    house.add(box(1.7, 0.4, 2.0, M.oakWood, -6.7, 0.3, -2.75));     // oak bed
    house.add(box(1.5, 0.24, 1.85, M.linen, -6.7, 0.58, -2.75));
    house.add(box(0.1, 0.95, 1.6, M.oakWood, -7.6, 0.85, -2.75));   // headboard
    house.add(box(0.42, 0.5, 0.42, M.oakWood, -6.6, 0.25, -1.45));
    house.add(box(0.42, 0.5, 0.42, M.oakWood, -6.6, 0.25, -4.05));
    for (let i = 0; i < 3; i++) {
      house.add(box(0.02, 0.5, 0.4, M.linen, -7.94, 2.1, -2.15 - i * 0.6)); // three frames
    }
    house.add(box(1.9, 0.03, 1.5, M.linen, -5.9, 0.12, -2.7));
    house.add(mkFan(-6, -2.7));
  }

  /* ---------- bunk room (front-left) ---------- */
  {
    house.add(box(1.05, 0.5, 2.1, M.whiteFurn, -7.35, 0.45, 2.6));  // lower bunk
    house.add(box(1.05, 0.45, 2.1, M.whiteFurn, -7.35, 1.65, 2.6)); // upper bunk
    house.add(box(1.0, 0.16, 2, M.linen, -7.35, 0.78, 2.6));
    house.add(box(1.0, 0.16, 2, M.linen, -7.35, 1.95, 2.6));
    for (let i = 0; i < 5; i++) {
      house.add(box(0.05, 0.9, 0.05, M.whiteFurn, -6.85, 1.55, 1.65 + i * 0.47)); // rail posts
    }
    house.add(box(0.06, 0.7, 1.2, M.dark, -4.62, 1.7, 2.6));        // wall TV
    house.add(box(1.6, 0.03, 1.3, M.linen, -5.9, 0.12, 2.4));
    house.add(mkFan(-6, 2.4));
  }

  /* ---------- spa bath (back-center) ---------- */
  {
    house.add(box(0.1, 2.5, 2.2, M.marble, -2.18, 1.25, -3.3));     // marble feature wall
    house.add(box(0.06, 0.5, 0.7, M.marble, -2.24, 1.7, -3.3));     // niche
    house.add(box(0.05, 2.1, 1.5, M.glass, -3.1, 1.05, -3.4));      // shower glass
    house.add(box(0.04, 2.1, 0.04, M.brass, -3.1, 1.05, -2.65));    // gold frame
    house.add(box(0.04, 2.1, 0.04, M.brass, -3.1, 1.05, -4.15));
    house.add(box(0.45, 0.05, 0.05, M.brass, -2.5, 2.28, -3.3));    // shower arm
    const rain = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 14), M.brass);
    rain.position.set(-2.72, 2.25, -3.3);
    house.add(rain);
    house.add(box(0.04, 1.1, 0.04, M.brass, -2.3, 1.35, -3.9));     // hand shower rail
    house.add(box(0.66, 0.9, 0.5, M.marble, -2.65, 0.45, -4.15));   // shower bench
    house.add(box(0.85, 0.03, 1.45, M.marble, -2.65, 0.09, -3.4));  // shower floor pad
    house.add(box(0.05, 0.6, 0.35, M.whiteFurn, -3.14, 1.6, -2.85));// towel on the glass
    house.add(box(1.3, 0.75, 0.5, M.whiteFurn, -3.6, 0.38, -1));    // vanity
    house.add(box(1.3, 0.05, 0.55, M.marble, -3.6, 0.78, -1));
    house.add(box(0.02, 0.7, 0.9, M.steel, -4.46, 1.7, -1));        // mirror
  }

  /* ---------- backyard ---------- */
  {
    scene.add(box(13, 0.12, 6.5, M.paver, 0.5, 0.02, -8.2));        // paver patio

    // pergola bar (right)
    const pg = new THREE.Group();
    for (const [px, pz] of [[2.6, -9.4], [6.4, -9.4], [2.6, -11.4], [6.4, -11.4]]) {
      pg.add(box(0.18, 2.5, 0.18, M.oakWood, px, 1.25, pz));
    }
    for (let i = 0; i < 7; i++) {
      pg.add(box(4.2, 0.06, 0.14, M.oakWood, 4.5, 2.55, -9.3 - i * 0.35));
    }
    pg.add(box(3.4, 1.05, 0.6, M.oakWood, 4.5, 0.52, -10.9));       // bar counter
    pg.add(box(3.5, 0.07, 0.75, M.oakWood, 4.5, 1.1, -10.9));
    for (let i = 0; i < 3; i++) {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.65, 10), M.oakWood);
      stool.position.set(3.4 + i * 1.1, 0.33, -10.1);
      pg.add(stool);
    }
    scene.add(pg);

    // putting green (left) — kidney shape with two flags
    const shape = new THREE.Shape();
    shape.moveTo(-6, -6.5);
    shape.bezierCurveTo(-3.5, -5.8, -1.5, -6.5, -1, -8);
    shape.bezierCurveTo(-0.6, -9.4, -2, -10.8, -4, -10.6);
    shape.bezierCurveTo(-5.2, -10.5, -5.6, -9.6, -6.8, -9.4);
    shape.bezierCurveTo(-8.2, -9.2, -8.4, -7.4, -6, -6.5);
    const green = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), M.turf);
    green.rotation.x = -Math.PI / 2;
    green.position.y = 0.05;
    green.scale.set(1, -1, 1);
    scene.add(green);
    const flagAt = (x, z) => {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), M.dark);
      hole.rotation.x = -Math.PI / 2;
      hole.position.set(x, 0.065, z);
      scene.add(hole);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), M.whiteFurn);
      pole.position.set(x, 0.8, z);
      scene.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), new THREE.MeshStandardMaterial({ color: 0xd83a2e, roughness: 0.9, side: THREE.DoubleSide }));
      flag.position.set(x + 0.22, 1.4, z);
      scene.add(flag);
    };
    flagAt(-2.2, -8.6);
    flagAt(-6.2, -8);

    // covered lounge (roof extension off the back door)
    scene.add(box(4.4, 0.14, 2.6, M.wall, 0.5, 2.5, -6.4));
    scene.add(box(0.14, 2.45, 0.14, M.whiteFurn, -1.5, 1.25, -7.55));
    scene.add(box(0.14, 2.45, 0.14, M.whiteFurn, 2.5, 1.25, -7.55));
    scene.add(box(1.8, 0.45, 0.8, M.rattan, 0.2, 0.35, -6.6));      // outdoor sofa
    scene.add(box(0.7, 0.32, 0.7, M.oakWood, 1.6, 0.28, -6.5));

    // hanging egg chair (right corner)
    const egg = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 14, Math.PI * 0.7, Math.PI * 1.35, 0.5, 1.9), M.rattan);
    shell.position.y = 1.05;
    egg.add(shell);
    egg.add(box(0.1, 0.08, 0.1, M.dark, 0, 2, 0));
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.1, 8), M.dark);
    arc.position.set(0.35, 1.05, 0);
    arc.rotation.z = 0.32;
    egg.add(arc);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.06, 16), M.dark);
    base.position.y = 0.03;
    egg.add(base);
    const cushion = box(0.7, 0.5, 0.5, M.linen, 0, 0.95, 0.1);
    egg.add(cushion);
    egg.position.set(7, 0, -7);
    egg.rotation.y = -0.7;
    scene.add(egg);

    // grill
    scene.add(box(0.9, 0.75, 0.55, M.dark, -6.8, 0.5, -5.6));
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.88, 14, 1, false, 0, Math.PI), M.steel);
    lid.rotation.z = Math.PI / 2;
    lid.position.set(-6.8, 0.9, -5.6);
    scene.add(lid);

    // string lights: pergola → covered patio, two swags
    const stringPts = (a, b, sag) => {
      const pts = [];
      for (let t = 0; t <= 1.001; t += 0.09) {
        pts.push(new THREE.Vector3(
          a.x + (b.x - a.x) * t,
          a.y + (b.y - a.y) * t - Math.sin(Math.PI * t) * sag,
          a.z + (b.z - a.z) * t
        ));
      }
      return pts;
    };
    const swags = [
      ...stringPts(new THREE.Vector3(2.6, 2.5, -9.4), new THREE.Vector3(-1.5, 2.45, -7.55), 0.4),
      ...stringPts(new THREE.Vector3(6.4, 2.5, -9.4), new THREE.Vector3(2.5, 2.45, -7.55), 0.35),
      ...stringPts(new THREE.Vector3(-1.5, 2.45, -7.55), new THREE.Vector3(-6, 2.2, -9.8), 0.45),
    ];
    for (const p of swags) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.bulb);
      b.position.copy(p);
      scene.add(b);
    }

    // white privacy fence around the back
    const seg = (x, z, w, rot = 0) => {
      const f = box(w, 1.75, 0.09, M.fence, x, 0.88, z);
      f.rotation.y = rot;
      scene.add(f);
    };
    seg(0, -14, 19);
    seg(-9.5, -9.5, 9.2, Math.PI / 2);
    seg(9.5, -9.5, 9.2, Math.PI / 2);
  }

  /* ---------- palms ---------- */
  const mkPalm = (x, z, h = 4.5, lean = 0.06) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, h, 8), M.palmTrunk);
    trunk.position.y = h / 2;
    trunk.rotation.z = lean;
    g.add(trunk);
    const top = new THREE.Vector3(Math.sin(lean) * -h, h, 0);
    for (let i = 0; i < 9; i++) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.5, 4, 1), M.palmFrond);
      const pos = frond.geometry.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const fx = pos.getX(v);
        pos.setY(v, pos.getY(v) - Math.pow(Math.max(fx, 0) / 2.1, 2) * 1.4);
      }
      frond.geometry.computeVertexNormals();
      frond.position.copy(top);
      frond.rotation.y = (i / 9) * Math.PI * 2;
      frond.rotation.z = -0.25;
      g.add(frond);
    }
    g.position.set(x, 0, z);
    return g;
  };
  scene.add(mkPalm(-3.5, 7.5, 5), mkPalm(10.5, 5, 4, -0.08), mkPalm(-10.5, -7, 5.5), mkPalm(10.8, -12.5, 4.6, 0.09));

  scene.add(house);

  /* ---------- camera rig ---------- */
  const state = {
    pos: new THREE.Vector3(...VISTA.pos),
    target: new THREE.Vector3(...VISTA.target),
    look: { yaw: 0, pitch: 0 },
    lookGoal: { yaw: 0, pitch: 0 },
    parallax: 0,
    atVista: true,
    running: true,
    dusk: 0, // 0 = noon, 1 = golden hour; tweened when entering/leaving the backyard
    t: 0,
  };

  const _dir = new THREE.Vector3();
  const _lookAt = new THREE.Vector3();
  const _sph = new THREE.Spherical();
  const _sunDir = new THREE.Vector3();

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

  function applyDusk() {
    const m = state.dusk;
    skyMat.uniforms.zenith.value.lerpColors(DAY.zenith, DUSK.zenith, m);
    skyMat.uniforms.horizon.value.lerpColors(DAY.horizon, DUSK.horizon, m);
    skyMat.uniforms.sunGlow.value.lerpColors(DAY.sunGlow, DUSK.sunGlow, m);
    _sunDir.lerpVectors(DAY.sunDir, DUSK.sunDir, m).normalize();
    skyMat.uniforms.sunDir.value.copy(_sunDir);
    skyMat.uniforms.duskAmt.value = m;
    scene.fog.color.lerpColors(DAY.fog, DUSK.fog, m);
    scene.fog.density = DAY.fogDensity + (DUSK.fogDensity - DAY.fogDensity) * m;
    sun.color.lerpColors(DAY.sunColor, DUSK.sunColor, m);
    sun.intensity = DAY.sunIntensity + (DUSK.sunIntensity - DAY.sunIntensity) * m;
    sun.position.copy(_sunDir).multiplyScalar(120);
    hemi.color.lerpColors(DAY.hemiSky, DUSK.hemiSky, m);
    hemi.groundColor.lerpColors(DAY.hemiGround, DUSK.hemiGround, m);
    hemi.intensity = DAY.hemiIntensity + (DUSK.hemiIntensity - DAY.hemiIntensity) * m;
    M.windowGlass.color.lerpColors(DAY.window, DUSK.window, m);
    M.bulb.emissiveIntensity = 0.05 + m * 2.4;
    cloudMat.opacity = 0.92 * (1 - m);
    for (const l of eveningLights) l.intensity = 4.5 + m * 18; // soft warmth by day, glow by dusk
    renderer.toneMappingExposure = 1.0 + m * 0.05;
  }

  /* ---------- render loop ---------- */
  const clock = new THREE.Clock();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    state.t += dt;

    const idle = reducedMotion ? 0 : Math.sin(state.t * 0.22) * 0.012;
    const k = 1 - Math.pow(0.0018, dt);
    state.look.yaw += (state.lookGoal.yaw + idle - state.look.yaw) * k;
    state.look.pitch += (state.lookGoal.pitch - state.look.pitch) * k;

    if (!reducedMotion) {
      for (const f of fans) f.userData.blades.rotation.y += dt * 6;
    }

    applyDusk();
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
  applyDusk();
  applyCamera();
  frame();

  /* ---------- public api ---------- */
  const gsapRef = window.gsap;

  function flyTo(pos, target, { instant = false } = {}) {
    if (instant || reducedMotion || !gsapRef) {
      gsapRef?.killTweensOf([state.pos, state.target, state.lookGoal]);
      state.pos.set(...pos);
      state.target.set(...target);
      state.lookGoal.yaw = state.lookGoal.pitch = 0;
      state.look.yaw = state.look.pitch = 0;
      return;
    }
    const d = 1.9;
    const ease = "power3.inOut";
    gsapRef.to(state.pos, { x: pos[0], y: pos[1], z: pos[2], duration: d, ease, overwrite: "auto" });
    gsapRef.to(state.target, { x: target[0], y: target[1], z: target[2], duration: d, ease, overwrite: "auto" });
    gsapRef.to(state.lookGoal, { yaw: 0, pitch: 0, duration: d * 0.6, ease: "power2.out", overwrite: "auto" });
  }

  function setDusk(on, instant) {
    const v = on ? 1 : 0;
    if (instant || reducedMotion || !gsapRef) {
      gsapRef?.killTweensOf(state, "dusk");
      state.dusk = v;
      return;
    }
    gsapRef.to(state, { dusk: v, duration: 2.6, ease: "power2.inOut", overwrite: "auto" });
  }

  let vistaTimer = 0;

  return {
    ok: true,
    viewpointCount: VIEWPOINTS.length,
    goTo(i, opts = {}) {
      const v = VIEWPOINTS[i];
      if (!v) return;
      window.clearTimeout(vistaTimer);
      state.atVista = false;
      flyTo(v.pos, v.target, opts);
      setDusk(i === DUSK_STOP, opts.instant);
    },
    goVista(opts = {}) {
      window.clearTimeout(vistaTimer);
      setDusk(false, opts.instant);
      if (opts.instant || reducedMotion || !gsapRef) {
        state.atVista = true;
        state.lookGoal.yaw = state.lookGoal.pitch = 0;
        return;
      }
      flyTo(VISTA.pos, VISTA.target);
      vistaTimer = window.setTimeout(() => { state.atVista = true; }, 1950);
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
