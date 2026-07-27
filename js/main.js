/* Fairway House — page orchestration.
   gsap / ScrollTrigger / Lenis are vendored globals; the 3D scene is a module. */

import { initScene } from "./scene.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const gsapOk = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
if (gsapOk) window.gsap.registerPlugin(window.ScrollTrigger);
const { gsap, ScrollTrigger } = window;

/* ---------- rooms (order matches VIEWPOINTS in scene.js) ---------- */

const ROOMS = [
  { name: "Curb side", note: "Fresh paint, palm out front, and parking for two cars back-to-back in the drive." },
  { name: "Living room", note: "A big white sectional, a bigger screen, and morning light through the shutters." },
  { name: "Kitchen", note: "Full white galley with brass pulls — stocked for real cooking, not just cereal." },
  { name: "Primary bedroom", note: "Queen bed, soft linens, and a ceiling fan doing slow laps." },
  { name: "The oak room", note: "Warm wood, a queen bed, and the quiet end of the hallway." },
  { name: "The bunk room", note: "Twin over twin with its own TV — negotiations for the top bunk not included." },
  { name: "The spa bath", note: "Marble walk-in shower with brass fixtures. Yes, in a rental." },
  { name: "The backyard", note: "Golden hour: string lights on, bar open, putting green waiting for a rematch." },
];

/* ---------- scene ---------- */

const canvas = document.getElementById("scene-canvas");
const scene = initScene(canvas, { reducedMotion });
if (!scene.ok) document.documentElement.classList.add("no-webgl");

/* ---------- tour ui ---------- */

const rail = document.getElementById("room-rail");
const roomName = document.getElementById("room-name");
const roomNote = document.getElementById("room-note");
const tourSection = document.getElementById("residence");
let current = 0;
let tourEntered = false;

ROOMS.forEach((room, i) => {
  const li = document.createElement("li");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-current", i === 0 ? "true" : "false");
  btn.innerHTML = `<span class="idx" aria-hidden="true">${i + 1}</span><span>${room.name}</span>`;
  btn.addEventListener("click", () => goToRoom(i));
  li.appendChild(btn);
  rail.appendChild(li);
});
const railButtons = [...rail.querySelectorAll("button")];

function setCaption(i) {
  roomName.textContent = ROOMS[i].name;
  roomNote.textContent = ROOMS[i].note;
}

function goToRoom(i, { instant = false } = {}) {
  const next = (i + ROOMS.length) % ROOMS.length;
  if (next === current && tourEntered && !instant) return;
  current = next;
  railButtons.forEach((b, bi) => b.setAttribute("aria-current", bi === current ? "true" : "false"));
  scene.ok && scene.goTo(current, { instant });

  if (gsapOk && !reducedMotion && !instant) {
    const caption = [roomName, roomNote];
    gsap.timeline({ overwrite: "auto" })
      .to(caption, { opacity: 0, y: -8, duration: 0.28, ease: "power2.in" })
      .add(() => setCaption(current))
      .to(caption, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", delay: 0.5 });
  } else {
    setCaption(current);
  }
}

document.getElementById("tour-prev").addEventListener("click", () => goToRoom(current - 1));
document.getElementById("tour-next").addEventListener("click", () => goToRoom(current + 1));

window.addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "")) return;
  const r = tourSection.getBoundingClientRect();
  const inView = r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.5;
  if (!inView) return;
  e.preventDefault();
  goToRoom(current + (e.key === "ArrowRight" ? 1 : -1));
});

/* drag to look — horizontal drags stay ours, vertical swipes keep scrolling */
if (scene.ok) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  tourSection.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a")) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    tourSection.classList.add("is-dragging");
  });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    scene.look((e.clientX - lastX) / window.innerWidth, (e.clientY - lastY) / window.innerHeight);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener("pointerup", () => {
    dragging = false;
    tourSection.classList.remove("is-dragging");
  });
}

/* ---------- smooth scroll ---------- */

let lenis = null;
if (!reducedMotion && typeof window.Lenis !== "undefined" && gsapOk) {
  lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToEl(target) {
  if (lenis) lenis.scrollTo(target, { duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
}

for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener("click", (e) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    scrollToEl(target);
    if (link.hasAttribute("data-goto-backyard")) {
      window.setTimeout(() => goToRoom(ROOMS.length - 1), lenis ? 900 : 300);
    }
  });
}

/* ---------- nav state ---------- */

const nav = document.querySelector(".site-nav");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- entrance + scroll choreography ---------- */

if (gsapOk && !reducedMotion) {
  gsap.timeline({ defaults: { ease: "power4.out" } })
    .from(".scene-layer", { opacity: 0, duration: 1.4, ease: "power2.inOut" }, 0)
    .from(".hero-card", { opacity: 0, y: 42, duration: 1.0 }, 0.5)
    .from([".hero-title", ".hero-sub", ".hero-meta", ".hero-actions"], { opacity: 0, y: 22, duration: 0.75, stagger: 0.09 }, 0.7)
    .from(".site-nav", { opacity: 0, y: -14, duration: 0.7 }, 0.9);

  if (scene.ok) {
    ScrollTrigger.create({
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 0.6,
      onUpdate: (self) => scene.setParallax(self.progress),
    });
  }

  ScrollTrigger.create({
    trigger: tourSection,
    start: "top 55%",
    end: "bottom 45%",
    onEnter: () => { tourEntered = true; scene.ok && scene.goTo(current); },
    onEnterBack: () => { scene.ok && scene.goTo(current); },
    onLeaveBack: () => { scene.ok && scene.goVista(); },
  });

  const rise = (targets, trigger, vars = {}) =>
    gsap.from(targets, {
      y: 32,
      opacity: 0,
      duration: 0.85,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: { trigger, start: "top 78%" },
      ...vars,
    });

  rise([".backyard-copy", ".amenity-list li"], ".backyard", { stagger: 0.06 });
  rise([".details-intro", ".details .row"], ".details", { y: 20, duration: 0.6, stagger: 0.05 });
  rise([".book .section-title", ".book p", ".book .btn"], ".book");
} else if (scene.ok) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target === tourSection && entry.isIntersecting) {
          tourEntered = true;
          scene.goTo(current, { instant: true });
        }
      }
    },
    { threshold: 0.4 }
  );
  io.observe(tourSection);
}

/* pause rendering while solid sections fully cover the canvas */
if (scene.ok) {
  const visible = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
      scene.setRunning(visible.size > 0);
    },
    { threshold: 0 }
  );
  io.observe(document.querySelector(".hero"));
  io.observe(tourSection);
}

/* ---------- gallery — lights up when photos/ has files ---------- */

const GALLERY_MANIFEST = [
  ["01-living-room.jpg", "Living room with the big screen and white sectional"],
  ["02-kitchen.jpg", "White galley kitchen with brass hardware"],
  ["03-primary-bedroom.jpg", "Primary bedroom, queen bed and ceiling fan"],
  ["04-oak-bedroom.jpg", "Second bedroom in warm oak"],
  ["05-bunk-room.jpg", "Bunk room, twin over twin"],
  ["06-spa-shower.jpg", "Marble walk-in shower with brass fixtures"],
  ["07-second-bath.jpg", "Second bathroom with glass shower"],
  ["08-backyard-dusk.jpg", "The backyard at dusk — pergola bar and putting green"],
  ["09-exterior.jpg", "The front of the house and driveway"],
  ["10-laundry.jpg", "In-house washer and dryer"],
];

{
  const section = document.getElementById("gallery");
  const grid = document.getElementById("gallery-grid");
  let shown = 0;
  for (const [file, alt] of GALLERY_MANIFEST) {
    const img = new Image();
    img.loading = "lazy";
    img.alt = alt;
    img.src = `photos/${file}`;
    img.addEventListener("load", () => {
      grid.appendChild(img);
      if (++shown === 1) section.hidden = false;
    });
  }
}
