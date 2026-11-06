/**
 * One entry per stop on the page. `main.ts` blends between neighbours as the visitor scrolls,
 * so changing how a part of the show looks only means editing its numbers here.
 */
export interface Pose {
  /** Page colours. */
  bg: string;
  fg: string;
  /** Radio position (x flips to the free side of the copy) and turn, in radians. */
  x: number;
  y: number;
  turn: number;
  tilt: number;
  scale: number;
  /** Camera distance and height. */
  dist: number;
  camY: number;
  /** 0 to 1 amounts for each staged effect. */
  voice: number; // sound rings from the speaker
  guest: number; // second radio, for The Conversation
  valves: number; // glow of the valves on the back
  stool: number; // the hot seat
  shake: number;
  bounce: number; // comic squash and stretch
  eyes: number; // googly eyes on the knobs
  power: number; // dial light
}

export interface Station extends Pose {
  id: string;
  name: string;
}

const base: Omit<Pose, "bg" | "fg"> = {
  x: 0, y: 0, turn: 0, tilt: 0, scale: 1, dist: 7, camY: 0.5,
  voice: 0, guest: 0, valves: 0, stool: 0, shake: 0, bounce: 0, eyes: 0, power: 1,
};

const CREAM = "#fff4dc";
const INK = "#160c33";

export const stations: Station[] = [
  { ...base, id: "hero", name: "ThisRadio", bg: "#1f1bb8", fg: CREAM, x: 2.15, turn: -0.5, tilt: 0.02, y: -0.35, scale: 0.95, dist: 11 },
  { ...base, id: "show", name: "ThisRadio", bg: "#1f1bb8", fg: CREAM, x: 2.15, turn: -0.85, dist: 8.6, camY: 1.5 },
  { ...base, id: "host", name: "Your host", bg: "#3a1a66", fg: CREAM, x: -1.5, turn: 0.45, scale: 0.9, dist: 9.8, camY: 0.9, voice: 0.6 },
  { ...base, id: "opening", name: "Opening", bg: "#ff9ebb", fg: INK, x: -2, turn: 0.32, dist: 8.2, voice: 1 },
  { ...base, id: "conversation", name: "The Conversation", bg: "#0b5b4c", fg: CREAM, x: 2, y: -0.7, turn: -0.3, dist: 9.6, camY: 0.9, voice: 1, guest: 1 },
  { ...base, id: "tech", name: "Tech Meets Business", bg: INK, fg: CREAM, x: -2, turn: Math.PI - 0.42, dist: 8, camY: 1, valves: 1 },
  { ...base, id: "hot-seat", name: "The Hot Seat", bg: "#cc2410", fg: CREAM, x: 2.1, y: 0.75, turn: -0.5, dist: 10, camY: -0.7, stool: 1, shake: 1, scale: 0.95 },
  { ...base, id: "comic-relief", name: "Comic Relief", bg: "#ffc91f", fg: INK, x: -2, turn: 0.12, dist: 8.2, camY: 0.3, bounce: 1, eyes: 1 },
  { ...base, id: "final-word", name: "Final Word", bg: "#ff9ebb", fg: INK, x: 2.1, turn: -0.6, dist: 8.4, camY: 2.1, voice: 0.35 },
  { ...base, id: "closing", name: "ThisRadio", bg: "#1f1bb8", fg: CREAM, x: 2.5, y: 0.75, turn: -0.35, tilt: 0.05, scale: 0.72, dist: 9, camY: 0.8, power: 0.15 },
];

export function blendPose(a: Pose, b: Pose, t: number, out: Pose): Pose {
  for (const key of Object.keys(a) as (keyof Pose)[]) {
    if (key === "bg" || key === "fg") continue;
    out[key] = a[key] + (b[key] - a[key]) * t;
  }
  return out;
}
