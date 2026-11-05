import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export interface Radio {
  root: THREE.Group;
  needle: THREE.Mesh;
  dialLight: THREE.MeshStandardMaterial;
  cone: THREE.Mesh;
  knobs: THREE.Object3D[];
  antenna: THREE.Group;
  valves: THREE.MeshStandardMaterial;
  eyes: { group: THREE.Group; pupil: THREE.Mesh }[];
}

const W = 3.4;
const H = 2.2;
const D = 1.15;

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** Speaker grille pattern, drawn once and used as a texture. */
function grilleTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#231a3d";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#0b0619";
  for (let y = 8; y < 256; y += 16) {
    for (let x = (y % 32 === 8 ? 8 : 16); x < 256; x += 16) {
      g.beginPath();
      g.arc(x, y, 4.6, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The dial's printed scale: six stations, the same six as the tuner on the page. */
function dialTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffe9b0";
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = "#160c33";
  for (let i = 0; i <= 60; i++) {
    const big = i % 10 === 0;
    g.fillRect(16 + i * 8, 26, big ? 4 : 2, big ? 44 : 22);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildRadio(bodyColor: string, accentColor: string): Radio {
  const root = new THREE.Group();

  const body = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.32, metalness: 0.02 });
  const accent = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: "#160c33", roughness: 0.55 });
  const brass = new THREE.MeshStandardMaterial({ color: "#d9a441", roughness: 0.28, metalness: 0.9 });
  const chrome = new THREE.MeshStandardMaterial({ color: "#e8e8ee", roughness: 0.16, metalness: 1 });

  root.add(mesh(new RoundedBoxGeometry(W, H, D, 8, 0.3), body));

  const front = D / 2;

  // Speaker: brass ring, grille, and a cone that pumps with the voice.
  const spX = -0.78;
  const ring = mesh(new THREE.TorusGeometry(0.72, 0.055, 16, 64), brass, spX, -0.02, front);
  root.add(ring);
  const grille = mesh(
    new THREE.CircleGeometry(0.7, 64),
    new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.8 }),
    spX, -0.02, front + 0.004,
  );
  grille.castShadow = false;
  root.add(grille);
  const cone = mesh(new THREE.SphereGeometry(0.26, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), brass, spX, -0.02, front - 0.14);
  cone.rotation.x = Math.PI / 2;
  root.add(cone);

  // Tuning window with a needle, lit from behind.
  const dial = dialTexture();
  const dialLight = new THREE.MeshStandardMaterial({
    map: dial, emissiveMap: dial, emissive: "#ffcf7a", emissiveIntensity: 1, roughness: 0.4,
  });
  const dX = 0.82;
  const dY = 0.5;
  root.add(mesh(new RoundedBoxGeometry(1.42, 0.5, 0.06, 4, 0.03), dark, dX, dY, front));
  const face = mesh(new THREE.PlaneGeometry(1.28, 0.36), dialLight, dX, dY, front + 0.033);
  face.castShadow = false;
  root.add(face);
  const needle = mesh(new THREE.BoxGeometry(0.022, 0.36, 0.01), new THREE.MeshBasicMaterial({ color: "#e0261a" }), dX, dY, front + 0.04);
  needle.castShadow = false;
  root.add(needle);

  // Two knobs, which become the eyes in Comic Relief.
  const knobGeo = new THREE.CylinderGeometry(0.25, 0.28, 0.18, 40);
  const knobs: THREE.Object3D[] = [];
  const eyes: Radio["eyes"] = [];
  const eyeWhite = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.25 });
  for (const kx of [0.45, 1.19]) {
    const pivot = new THREE.Group();
    pivot.position.set(kx, -0.38, front + 0.08);
    pivot.rotation.x = Math.PI / 2;
    const knob = mesh(knobGeo, accent);
    pivot.add(knob);
    pivot.add(mesh(new THREE.BoxGeometry(0.04, 0.02, 0.22), new THREE.MeshBasicMaterial({ color: "#fff4dc" }), 0, 0.095, 0.13));
    root.add(pivot);
    knobs.push(pivot);

    const group = new THREE.Group();
    group.position.set(kx, -0.38, front + 0.19);
    group.add(mesh(new THREE.SphereGeometry(0.34, 32, 20), eyeWhite));
    group.children[0].scale.z = 0.35;
    const pupil = mesh(new THREE.SphereGeometry(0.14, 24, 16), dark, 0, 0, 0.09);
    pupil.scale.z = 0.5;
    group.add(pupil);
    group.scale.setScalar(0.001);
    root.add(group);
    eyes.push({ group, pupil });
  }

  // Handle on top and antenna on a pivot, so it can wobble.
  const handle = mesh(new THREE.TorusGeometry(0.72, 0.06, 12, 40, Math.PI), dark, -0.5, H / 2 - 0.05, 0);
  handle.scale.y = 0.55;
  root.add(handle);
  const antenna = new THREE.Group();
  antenna.position.set(1.28, H / 2 - 0.02, -0.28);
  antenna.rotation.z = -0.3;
  let r = 0.032;
  let at = 0;
  for (const len of [0.55, 0.5, 0.45]) {
    antenna.add(mesh(new THREE.CylinderGeometry(r * 0.8, r, len, 12), chrome, 0, at + len / 2, 0));
    at += len - 0.02;
    r *= 0.75;
  }
  antenna.add(mesh(new THREE.SphereGeometry(0.06, 16, 12), accent, 0, at + 0.03, 0));
  root.add(antenna);

  // Feet.
  for (const fx of [-1.2, 1.2]) root.add(mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.14, 20), dark, fx, -H / 2 - 0.05, 0));

  // Back: exposed circuit board and glowing valves, seen in Tech Meets Business.
  const back = -D / 2;
  const board = mesh(
    new THREE.BoxGeometry(W - 0.75, H - 0.6, 0.04),
    new THREE.MeshStandardMaterial({ color: "#0f6b4f", roughness: 0.5 }),
    0, 0, back - 0.005,
  );
  root.add(board);
  const trace = new THREE.MeshBasicMaterial({ color: "#d9a441" });
  for (let i = 0; i < 7; i++) {
    const y = -0.65 + i * 0.22;
    const len = 0.5 + ((i * 37) % 10) * 0.16;
    const sx = -1.15 + ((i * 53) % 7) * 0.09;
    const t = mesh(new THREE.BoxGeometry(len, 0.018, 0.005), trace, sx + len / 2, y, back - 0.03);
    t.castShadow = false;
    root.add(t);
  }
  const valves = new THREE.MeshStandardMaterial({
    color: "#ff9a3d", emissive: "#ff6a00", emissiveIntensity: 0.1, transparent: true, opacity: 0.92, roughness: 0.12,
  });
  [-0.85, -0.2, 0.45].forEach((vx, i) => {
    const h = 0.62 - i * 0.08;
    const v = mesh(new THREE.CapsuleGeometry(0.17, h, 8, 20), valves, vx, 0.15, back - 0.24);
    v.castShadow = false;
    root.add(v);
    root.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 24), dark, vx, -0.32 + i * 0.04, back - 0.24));
  });
  // A short stack of brass coins beside the valves: the business half of the part.
  for (let i = 0; i < 5; i++) {
    root.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 28), brass, 1.0, -0.5 + i * 0.056, back - 0.24));
  }

  return { root, needle, dialLight, cone, knobs, antenna, valves, eyes };
}
