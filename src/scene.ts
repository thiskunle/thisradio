import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildRadio } from "./radio";
import type { Pose } from "./stations";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const RING_COUNT = 5;

export interface Scene {
  /** Draws one frame. `progress` is 0 to 1 along the dial; `reduced` turns idle motion off. */
  render(pose: Pose, progress: number, time: number, reduced: boolean, landing: number): void;
  resize(): void;
}

export function createScene(canvas: HTMLCanvasElement): Scene {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

  const key = new THREE.DirectionalLight("#fff1dd", 2.4);
  key.position.set(3.5, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6, near: 1, far: 22 });
  scene.add(key);
  const rim = new THREE.DirectionalLight("#bcd0ff", 1.3);
  rim.position.set(-5, 2.5, -5);
  scene.add(rim);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.ShadowMaterial({ opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // The host's radio, and a second, differently coloured one for the guest.
  const host = buildRadio("#fff0cf", "#e0351f");
  const guest = buildRadio("#ffc91f", "#1f1bb8");
  guest.root.visible = false;
  scene.add(host.root, guest.root);

  // Warm light thrown by the valves onto the board.
  const valveGlow = new THREE.PointLight("#ff8a2a", 0, 5);
  valveGlow.position.set(-0.2, 0.2, -1.2);
  host.root.add(valveGlow);

  // Sound rings from the speakers.
  const ringMats: THREE.MeshBasicMaterial[] = [];
  const makeRings = (parent: THREE.Object3D) => {
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < RING_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      ringMats.push(mat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.012, 8, 72), mat);
      ring.position.set(-0.78, -0.02, 0.6);
      parent.add(ring);
      rings.push(ring);
    }
    return rings;
  };
  const hostRings = makeRings(host.root);
  const guestRings = makeRings(guest.root);

  // The hot seat: a stool, rising from below, with an ember-lit top.
  const stool = new THREE.Group();
  const ember = new THREE.MeshStandardMaterial({ color: "#2a1208", emissive: "#ff4a10", emissiveIntensity: 1.6, roughness: 0.6 });
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.2, 48), ember);
  seat.castShadow = true;
  stool.add(seat);
  const legMat = new THREE.MeshStandardMaterial({ color: "#160c33", roughness: 0.4, metalness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 2.1, 12), legMat);
    leg.position.set(Math.cos(a) * 1.25, -1.1, Math.sin(a) * 1.25);
    leg.rotation.set(Math.sin(a) * 0.14, 0, -Math.cos(a) * 0.14);
    leg.castShadow = true;
    stool.add(leg);
  }
  scene.add(stool);

  const look = new THREE.Vector3();
  let landscape = true;
  let fit = 1;

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, w < 760 ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    landscape = camera.aspect > 1;
    // Narrow screens pull the camera back so the whole radio stays in frame.
    fit = landscape ? Math.max(1, 1.6 / camera.aspect) : Math.min(2.1, 1.05 / camera.aspect);
  };
  resize();

  const pulseRings = (rings: THREE.Mesh[], amount: number, time: number, speed: number) => {
    rings.forEach((ring, i) => {
      const life = (time * speed + i / RING_COUNT) % 1;
      ring.scale.setScalar(1 + life * 2.6);
      ring.position.z = 0.6 + life * 1.5;
      (ring.material as THREE.MeshBasicMaterial).opacity = amount * (1 - life) * 0.75;
    });
  };

  return {
    resize,
    render(pose, progress, time, reduced, landing) {
      const t = reduced ? 0 : time;
      const r = host.root;

      // Placement. On portrait screens the radio takes the top half, above the copy.
      // Portrait: when the guest joins, the host steps right and the guest stands behind on the left.
      const px = landscape ? pose.x : pose.guest * 0.85;
      const py = landscape ? pose.y : pose.y + 1.25 * fit;
      // The floor stays under the radio's resting place, so its shadow lands with it.
      floor.position.y = py - 1.25 * pose.scale - 0.12;
      floor.visible = landscape && pose.stool < 0.5 && pose.y < 0.4;
      r.position.set(px, py + landing, 0);
      r.rotation.set(pose.tilt, pose.turn, 0);

      const breath = reduced ? 0 : Math.sin(t * 0.9) * 0.012;
      let sy = pose.scale * (1 + breath);
      let sx = pose.scale * (1 - breath);

      // Comic Relief: squash and stretch on a bounce, feet leaving the floor.
      if (pose.bounce > 0.01 && !reduced) {
        const hop = Math.abs(Math.sin(t * 3.4));
        const squash = Math.max(0, 1 - hop * 3.2);
        r.position.y += pose.bounce * hop * 0.75;
        sy *= 1 - pose.bounce * squash * 0.2;
        sx *= 1 + pose.bounce * squash * 0.14;
        r.rotation.z = pose.bounce * Math.sin(t * 1.7) * 0.11;
      }
      // The Hot Seat: a nervous tremble.
      if (pose.shake > 0.01 && !reduced) {
        r.position.x += Math.sin(t * 41) * 0.012 * pose.shake;
        r.position.y += Math.sin(t * 53) * 0.01 * pose.shake;
        r.rotation.z += Math.sin(t * 37) * 0.006 * pose.shake;
      }
      r.scale.set(sx, sy, sx);

      // Scene-wide parts driven by the dial.
      const sweep = progress * 1.08 - 0.54;
      host.needle.position.x = 0.82 + sweep;
      guest.needle.position.x = 0.82 - sweep;
      host.knobs[0].rotation.y = progress * Math.PI * 5;
      host.knobs[1].rotation.y = -progress * Math.PI * 2;
      host.dialLight.emissiveIntensity = 0.12 + pose.power * 1.1;
      host.valves.emissiveIntensity = 0.1 + pose.valves * (3 + (reduced ? 0 : Math.sin(t * 7) * 0.5));
      valveGlow.intensity = pose.valves * 9;
      host.cone.scale.setScalar(1 + (reduced ? 0 : pose.voice * Math.max(0, Math.sin(t * 9)) * 0.14));

      // Antenna sways; it whips about while the radio bounces.
      host.antenna.rotation.z = -0.3 + (reduced ? 0 : Math.sin(t * 1.3) * 0.015 + pose.bounce * Math.sin(t * 6.8) * 0.2);

      // Rings take turns between the two radios when the guest is on.
      const turn = reduced ? 1 : pose.guest > 0.5 ? clamp01(Math.sin(t * 0.8) * 4 + 0.5) : 1;
      pulseRings(hostRings, reduced ? 0 : pose.voice * turn, t, 0.42);
      pulseRings(guestRings, reduced ? 0 : pose.voice * (1 - turn) * pose.guest, t, 0.42);

      // The guest slides in from the far side, facing the host.
      guest.root.visible = pose.guest > 0.01;
      if (guest.root.visible) {
        const e = pose.guest;
        const s = pose.scale * 0.84 * e;
        if (landscape) guest.root.position.set(px - 4 * e, pose.y, -0.4);
        else guest.root.position.set(px - 2.1 * e, py + 0.9, -2.6);
        guest.root.rotation.set(0, landscape ? 0.48 : 0.3, 0);
        guest.root.scale.setScalar(Math.max(s, 0.001));
      }

      // The stool rises under the radio.
      stool.visible = pose.stool > 0.01;
      if (stool.visible) {
        const below = r.position.y - 1.25 * pose.scale - 0.14;
        stool.position.set(r.position.x, below - (1 - pose.stool) * 3.5, 0);
        stool.scale.setScalar(pose.scale);
        ember.emissiveIntensity = 1.4 + (reduced ? 0 : Math.sin(t * 5) * 0.4);
      }

      // Googly eyes grow over the knobs; pupils roll with the bounce.
      host.eyes.forEach((eye, i) => {
        eye.group.scale.setScalar(Math.max(pose.eyes, 0.001));
        eye.group.visible = pose.eyes > 0.01;
        const a = reduced ? 0 : t * 5.1 + i * 1.4;
        const down = reduced ? -0.05 : -0.04 - Math.abs(Math.sin(t * 3.4)) * 0.1;
        eye.pupil.position.set(Math.sin(a) * 0.11, down + Math.cos(a) * 0.05, 0.1);
      });

      // Camera. The portrait pull-back multiplies distance; a slight drift keeps it alive.
      const dist = pose.dist * fit;
      camera.position.set(reduced ? 0 : Math.sin(t * 0.22) * 0.1, pose.camY * (landscape ? 1 : 0.7) + (landscape ? 0 : py), dist);
      look.set(0, landscape ? 0 : py - 1.25 * fit * 0.86, 0);
      camera.lookAt(look);

      renderer.render(scene, camera);
    },
  };
}
