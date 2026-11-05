import "@fontsource-variable/anybody/standard.css";
import "@fontsource-variable/schibsted-grotesk";
import "./styles.css";
import { blendPose, stations, type Pose } from "./stations";
import { createStatic } from "./static";
import type { Scene } from "./scene";

const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const wordmark = document.querySelector<HTMLElement>("[data-wordmark]")!;
const needle = document.querySelector<HTMLElement>("[data-needle]")!;
const now = document.querySelector<HTMLElement>("[data-now]")!;
const scale = document.querySelector<HTMLElement>(".tuner-scale")!;
const tuneLinks = [...document.querySelectorAll<HTMLAnchorElement>("[data-tune]")];
const staticBtn = document.querySelector<HTMLButtonElement>("[data-static]")!;

const sections = stations.map((s) => document.querySelector<HTMLElement>(`[data-station="${s.id}"]`)!);
/** Scroll position at which each station is fully tuned in. */
let stops: number[] = [];

function measure() {
  const vh = window.innerHeight;
  const last = document.documentElement.scrollHeight - vh;
  stops = sections.map((el, i) => {
    if (i === 0) return 0;
    if (i === sections.length - 1) return last;
    const box = el.getBoundingClientRect();
    return box.top + window.scrollY + (box.height - vh) * 0.45;
  });
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Holds on a station for the first and last stretch of the scroll between two stops. */
const hold = (t: number) => smooth(Math.min(1, Math.max(0, (t - 0.18) / 0.64)));

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const bgRgb = stations.map((s) => hexToRgb(s.bg));

const pose: Pose = { ...stations[0] };
const dropIn = { t: reduced.matches ? 1 : 0 };
const sound = createStatic();

let scene: Scene | undefined;
let smoothScroll = window.scrollY;
let lastNow = "";
let lastFg = "";
let lastTime = performance.now();
let frameRequested = false;

/** Returns the station index as a float for a scroll position. */
function stationAt(y: number): number {
  for (let i = 0; i < stops.length - 1; i++) {
    if (y <= stops[i + 1]) return i + Math.max(0, (y - stops[i]) / Math.max(1, stops[i + 1] - stops[i]));
  }
  return stops.length - 1;
}

function frame(ms: number) {
  frameRequested = false;
  const dt = Math.min(0.05, (ms - lastTime) / 1000);
  lastTime = ms;
  const still = reduced.matches;

  // The scene chases the real scroll position, so it glides with mouse wheels too.
  const target = window.scrollY;
  smoothScroll = still ? target : mix(smoothScroll, target, 1 - Math.exp(-dt * 7));

  const pos = stationAt(smoothScroll);
  const i = Math.min(stations.length - 2, Math.floor(pos));
  const raw = pos - i;
  const t = hold(raw);
  blendPose(stations[i], stations[i + 1], t, pose);

  // Page colours follow the same blend; text flips at the midpoint.
  const [a, b] = [bgRgb[i], bgRgb[i + 1]];
  root.style.setProperty("--bg", `rgb(${mix(a[0], b[0], t) | 0} ${mix(a[1], b[1], t) | 0} ${mix(a[2], b[2], t) | 0})`);
  const nearest = stations[t < 0.5 ? i : i + 1];
  if (nearest.fg !== lastFg) {
    lastFg = nearest.fg;
    root.style.setProperty("--fg", nearest.fg);
  }

  // Needle on the dial: stations 2 to 7 (the six parts) sit at the centres of the six slots.
  const dial = Math.min(1, Math.max(0, (pos - 2 + 0.5) / 6));
  needle.style.transform = `translateX(${dial * scale.clientWidth}px)`;

  if (nearest.name !== lastNow) {
    lastNow = nearest.name;
    now.textContent = nearest.name;
    for (const link of tuneLinks) {
      if (link.dataset.tune === nearest.id) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  }

  sound.update(Math.sin(smooth(t) * Math.PI) * (t > 0 && t < 1 ? 1 : 0));

  // The logo shrinks back and fades as the hero scrolls away.
  const leaving = smooth(Math.min(1, smoothScroll / Math.max(1, stops[1])));
  wordmark.style.transform = `translateY(${leaving * -6}svh) scale(${mix(1, 0.82, leaving)})`;
  wordmark.style.opacity = String(mix(1, 0.25, leaving));
  // Page-load moment: the radio drops in and settles.
  if (dropIn.t < 1) dropIn.t = Math.min(1, dropIn.t + dt / 1.5);
  const d = dropIn.t;
  const landing = d < 1 ? (1 - d) ** 2 * 7 * Math.abs(Math.cos(d * Math.PI * 3.5)) : 0;

  if (scene) scene.render(pose, dial, ms / 1000, still, landing);

  // Keep animating only while the scene needs it; a static fallback idles on scroll.
  if (scene ? !still || Math.abs(target - smoothScroll) > 0.5 : Math.abs(target - smoothScroll) > 0.5) request();
}

function request() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(frame);
}

function tuneJump(event: Event, link: HTMLAnchorElement) {
  const i = stations.findIndex((s) => s.id === link.dataset.tune);
  if (i < 0) return;
  event.preventDefault();
  history.pushState(null, "", link.hash);
  window.scrollTo({ top: stops[i], behavior: reduced.matches ? "auto" : "smooth" });
}
tuneLinks.forEach((link) => link.addEventListener("click", (e) => tuneJump(e, link)));

staticBtn.addEventListener("click", async () => {
  const on = await sound.toggle();
  staticBtn.setAttribute("aria-pressed", String(on));
  staticBtn.textContent = on ? "Turn off static" : "Turn on static";
});

window.addEventListener("scroll", request, { passive: true });
window.addEventListener("resize", () => {
  measure();
  scene?.resize();
  request();
});
reduced.addEventListener("change", request);
document.addEventListener("visibilitychange", request);

measure();
document.fonts?.ready.then(() => {
  measure();
  request();
});
request();

// Three.js loads after the words, so the page is readable straight away.
import("./scene")
  .then(({ createScene }) => {
    scene = createScene(canvas);
    request();
  })
  .catch(() => root.classList.add("no-webgl"));
