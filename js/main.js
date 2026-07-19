/* Villa Vermiglia — page orchestration.
   gsap / ScrollTrigger / Lenis are vendored globals; the 3D scene is a module. */

import { initScene } from "./scene.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const gsapOk = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
if (gsapOk) window.gsap.registerPlugin(window.ScrollTrigger);
const { gsap, ScrollTrigger } = window;

/* ---------- rooms (order matches VIEWPOINTS in scene.js) ---------- */

const ROOMS = [
  { name: "Arrival", note: "The drive turns, the hills open, and the house appears against the last of the sun." },
  { name: "The Great Room", note: "Six metres of glass to the valley. One room, one horizon." },
  { name: "Kitchen & Dining", note: "A travertine island, twelve seats, and the evening pouring in from the west." },
  { name: "The Primary Suite", note: "Wake to the ridge line. The glass runs the full width of the bed." },
  { name: "The Study", note: "The quietest room in the house, one floor above the noise of nothing." },
  { name: "Terrace & Pool", note: "Twenty-five metres of still water, ending where the hills begin." },
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
      .to(caption, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", delay: 0.55 });
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

for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener("click", (e) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.4, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  });
}

/* ---------- nav state ---------- */

const nav = document.querySelector(".site-nav");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------- entrance + scroll choreography ---------- */

if (gsapOk && !reducedMotion) {
  // one rehearsed entrance: dusk fades up, the name rises, the details follow
  gsap.timeline({ defaults: { ease: "power4.out" } })
    .from(".scene-layer", { opacity: 0, duration: 1.8, ease: "power2.inOut" }, 0)
    .from(".hero-title .line > span", { yPercent: 115, duration: 1.15, stagger: 0.14 }, 0.45)
    .from([".hero-tag", ".hero-meta"], { opacity: 0, y: 24, duration: 0.9, stagger: 0.12 }, 1.0)
    .from(".site-nav", { opacity: 0, y: -16, duration: 0.8 }, 1.2)
    .from(".hero-scrollcue", { opacity: 0, duration: 0.8 }, 1.5);

  // hero dolly: the camera eases toward the house as you leave the vista
  if (scene.ok) {
    ScrollTrigger.create({
      trigger: ".hero",
      start: "top top",
      end: "bottom top",
      scrub: 0.6,
      onUpdate: (self) => scene.setParallax(self.progress),
    });
  }

  // walkthrough activation
  ScrollTrigger.create({
    trigger: tourSection,
    start: "top 55%",
    end: "bottom 45%",
    onEnter: () => { tourEntered = true; goToRoom(current, {}); scene.ok && scene.goTo(current); },
    onEnterBack: () => { scene.ok && scene.goTo(current); },
    onLeaveBack: () => { scene.ok && scene.goVista(); },
  });

  // section reveals — each shaped to what it reveals, played once
  const rise = (targets, trigger, vars = {}) =>
    gsap.from(targets, {
      y: 36,
      opacity: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.08,
      scrollTrigger: { trigger, start: "top 78%" },
      ...vars,
    });

  rise([".estate .section-title", ".estate-lede", ".estate-body", ".fact-strip"], ".estate");
  rise(".material", ".material-list", { y: 28, stagger: 0.12 });
  rise(".particulars .row", ".particulars dl", { y: 18, duration: 0.6, stagger: 0.05 });
  rise([".location .section-title", ".location-body", ".distance-list li"], ".location-grid > div");
  rise([".enquire-copy", ".enquire-form"], ".enquire", { stagger: 0.15 });

  // the hills draw themselves
  const contours = document.querySelectorAll(".contour-map .contour");
  contours.forEach((path, i) => {
    const len = path.getTotalLength();
    gsap.fromTo(path,
      { strokeDasharray: len, strokeDashoffset: len },
      {
        strokeDashoffset: 0,
        duration: 1.6,
        ease: "power2.inOut",
        delay: i * 0.12,
        scrollTrigger: { trigger: ".contour-map", start: "top 75%" },
      });
  });
  gsap.from(".contour-map .estate-mark, .contour-map .estate-label", {
    opacity: 0,
    duration: 0.8,
    delay: 1.1,
    scrollTrigger: { trigger: ".contour-map", start: "top 75%" },
  });
} else {
  // reduced motion or no gsap: everything is already visible; jump cuts only
  if (scene.ok) {
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

/* ---------- enquiry form ---------- */

const form = document.getElementById("enquire-form");
const statusEl = document.getElementById("form-status");
const submitBtn = document.getElementById("enquire-submit");

const validators = {
  name: (v) => (v.trim().length >= 2 ? "" : "Please tell us your name."),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "That email doesn't look right."),
};

function validateField(fieldEl) {
  const input = fieldEl.querySelector("input, textarea");
  const check = validators[fieldEl.dataset.field];
  const message = check ? check(input.value) : "";
  fieldEl.classList.toggle("is-invalid", Boolean(message));
  fieldEl.querySelector(".field-error").textContent = message;
  return !message;
}

for (const fieldEl of form.querySelectorAll(".field")) {
  const input = fieldEl.querySelector("input, textarea");
  input.addEventListener("blur", () => validateField(fieldEl));
  input.addEventListener("input", () => {
    if (fieldEl.classList.contains("is-invalid")) validateField(fieldEl);
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const fields = [...form.querySelectorAll(".field")];
  const ok = fields.map(validateField).every(Boolean);
  if (!ok) {
    statusEl.textContent = "";
    form.querySelector(".is-invalid input, .is-invalid textarea")?.focus();
    return;
  }
  submitBtn.disabled = true;
  statusEl.classList.remove("is-success");
  statusEl.textContent = "Sending your request…";
  window.setTimeout(() => {
    submitBtn.disabled = false;
    statusEl.classList.add("is-success");
    statusEl.textContent = "Thank you — we will be in touch within the day to arrange your viewing.";
    form.reset();
  }, 900);
});
