import * as THREE from 'three';
import { skinOf } from '../skins';

export type Pose = 'idle' | 'run' | 'jump' | 'hang' | 'balance' | 'fall' | 'swim' | 'cheer' | 'throw' | 'think' | 'sad' | 'stun' | 'sit';

const mat = (color: string, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true });

export interface Avatar {
  root: THREE.Group;
  body: THREE.Group;
  setPose: (pose: Pose, t: number, opts?: { balance?: number; speed?: number }) => void;
  setGray: (gray: boolean) => void;
  dispose: () => void;
}

/** Personnage stylisé « low poly » construit à partir de formes simples. */
export function createAvatar(skinId: number, teamColor: string): Avatar {
  const s = skinOf(skinId);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const materials: THREE.MeshStandardMaterial[] = [];
  const m = (c: string, r?: number) => {
    const x = mat(c, r);
    materials.push(x);
    return x;
  };
  const skinM = m(s.skin, 0.6);
  const topM = m(s.top);
  const bottomM = m(s.bottom);
  const hairM = m(s.hair, 0.9);
  const teamM = m(teamColor, 0.5);
  const darkM = m('#111111', 0.4);
  const k = s.build;

  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Hanches (pivot du haut du corps)
  const hips = new THREE.Group();
  hips.position.y = 0.92;
  body.add(hips);

  // Jambes
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(0.14 * side * k, 0, 0);
    hips.add(leg);
    add(leg, new THREE.CylinderGeometry(0.11 * k, 0.1 * k, 0.42, 7), bottomM, 0, -0.2, 0);
    add(leg, new THREE.CylinderGeometry(0.075 * k, 0.065 * k, 0.45, 7), skinM, 0, -0.62, 0);
    add(leg, new THREE.BoxGeometry(0.14 * k, 0.08, 0.26), darkM, 0, -0.88, 0.05);
    legs.push(leg);
  }

  // Torse
  const torso = new THREE.Group();
  hips.add(torso);
  add(torso, new THREE.CylinderGeometry(0.26 * k, 0.21 * k, 0.6, 8), topM, 0, 0.3, 0);
  add(torso, new THREE.SphereGeometry(0.26 * k, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), topM, 0, 0.6, 0);

  // Bras
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0.33 * side * k, 0.58, 0);
    torso.add(arm);
    add(arm, new THREE.CylinderGeometry(0.075 * k, 0.065 * k, 0.32, 7), topM, 0, -0.14, 0);
    add(arm, new THREE.CylinderGeometry(0.06 * k, 0.055 * k, 0.32, 7), skinM, 0, -0.44, 0);
    add(arm, new THREE.SphereGeometry(0.07 * k, 6, 5), skinM, 0, -0.62, 0);
    arms.push(arm);
  }
  // Bandana d'équipe au bras gauche
  add(arms[0], new THREE.CylinderGeometry(0.085 * k, 0.085 * k, 0.07, 8), teamM, 0, -0.1, 0);

  // Tête
  const head = new THREE.Group();
  head.position.y = 0.9;
  torso.add(head);
  add(head, new THREE.CylinderGeometry(0.07, 0.08, 0.12, 6), skinM, 0, -0.08, 0);
  add(head, new THREE.SphereGeometry(0.22, 10, 8), skinM, 0, 0.14, 0);
  for (const side of [-1, 1]) add(head, new THREE.SphereGeometry(0.028, 6, 4), darkM, 0.075 * side, 0.17, 0.2);
  add(head, new THREE.BoxGeometry(0.1, 0.018, 0.02), m('#7f1d1d'), 0, 0.07, 0.205);

  // Coiffure
  const cap = () => add(head, new THREE.SphereGeometry(0.235, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.1), hairM, 0, 0.16, -0.01);
  switch (s.hairStyle) {
    case 'court':
      cap();
      break;
    case 'long':
      cap();
      add(head, new THREE.BoxGeometry(0.42, 0.42, 0.14), hairM, 0, 0.02, -0.14);
      break;
    case 'chignon':
      cap();
      add(head, new THREE.SphereGeometry(0.1, 8, 6), hairM, 0, 0.42, -0.08);
      break;
    case 'queue':
      cap();
      add(head, new THREE.CylinderGeometry(0.05, 0.02, 0.36, 6), hairM, 0, 0.08, -0.27).rotation.x = 0.5;
      break;
    case 'boucles':
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        add(head, new THREE.SphereGeometry(0.1, 6, 5), hairM, Math.cos(a) * 0.17, 0.3 + Math.sin(i) * 0.03, Math.sin(a) * 0.17 - 0.03);
      }
      add(head, new THREE.SphereGeometry(0.12, 6, 5), hairM, 0, 0.38, 0);
      break;
    case 'crete':
      add(head, new THREE.BoxGeometry(0.06, 0.18, 0.36), hairM, 0, 0.4, -0.02);
      break;
    case 'rase':
      add(head, new THREE.SphereGeometry(0.226, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), m(s.hair, 1), 0, 0.15, 0).scale.set(1, 0.9, 1);
      break;
  }
  // Accessoires
  if (s.accessory === 'barbe') add(head, new THREE.BoxGeometry(0.3, 0.14, 0.12), hairM, 0, 0.0, 0.14);
  if (s.accessory === 'moustache') add(head, new THREE.BoxGeometry(0.14, 0.03, 0.03), hairM, 0, 0.1, 0.21);
  if (s.accessory === 'lunettes') {
    for (const side of [-1, 1]) add(head, new THREE.TorusGeometry(0.05, 0.012, 4, 10), darkM, 0.075 * side, 0.17, 0.21);
  }
  if (s.accessory === 'chapeau') {
    add(head, new THREE.CylinderGeometry(0.38, 0.38, 0.03, 12), m('#a16207'), 0, 0.33, 0);
    add(head, new THREE.CylinderGeometry(0.2, 0.23, 0.18, 10), m('#ca8a04'), 0, 0.42, 0);
  } else {
    // bandana sur le front
    add(head, new THREE.TorusGeometry(0.225, 0.03, 4, 16), teamM, 0, 0.27, 0).rotation.x = Math.PI / 2 - 0.15;
  }

  const reset = () => {
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    hips.rotation.set(0, 0, 0);
    torso.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    for (const l of legs) l.rotation.set(0, 0, 0);
    for (const a of arms) a.rotation.set(0, 0, 0);
  };

  const setPose: Avatar['setPose'] = (pose, t, opts = {}) => {
    reset();
    const sp = opts.speed ?? 1;
    const bal = opts.balance ?? 0;
    switch (pose) {
      case 'idle':
        torso.rotation.x = Math.sin(t * 1.5) * 0.02;
        arms[0].rotation.z = -0.08;
        arms[1].rotation.z = 0.08;
        head.rotation.y = Math.sin(t * 0.6) * 0.3;
        break;
      case 'run': {
        const c = Math.sin(t * 11 * sp);
        legs[0].rotation.x = c * 0.9;
        legs[1].rotation.x = -c * 0.9;
        arms[0].rotation.x = -c * 0.9;
        arms[1].rotation.x = c * 0.9;
        torso.rotation.x = 0.18;
        body.position.y = Math.abs(Math.cos(t * 11 * sp)) * 0.08;
        break;
      }
      case 'jump':
        body.position.y = 0.55;
        legs[0].rotation.x = -1.1;
        legs[1].rotation.x = 0.6;
        arms[0].rotation.x = -2.4;
        arms[1].rotation.x = -2.4;
        break;
      case 'stun':
        body.rotation.z = Math.sin(t * 8) * 0.25;
        head.rotation.z = Math.sin(t * 10) * 0.4;
        arms[0].rotation.z = -0.9;
        arms[1].rotation.z = 0.9;
        break;
      case 'hang':
        arms[0].rotation.x = Math.PI;
        arms[1].rotation.x = Math.PI;
        arms[0].rotation.z = 0.12;
        arms[1].rotation.z = -0.12;
        legs[0].rotation.x = 0.2 + Math.sin(t * 2) * 0.1;
        legs[1].rotation.x = -0.1 + Math.cos(t * 2) * 0.1;
        body.rotation.z = bal * 0.5;
        break;
      case 'balance':
        arms[0].rotation.z = -1.4 + bal * 0.6 + Math.sin(t * 3) * 0.1;
        arms[1].rotation.z = 1.4 + bal * 0.6 - Math.sin(t * 3) * 0.1;
        legs[1].rotation.x = -0.6;
        legs[1].rotation.z = 0.2;
        body.rotation.z = bal * 0.45;
        break;
      case 'fall':
      case 'swim':
        body.position.y = -0.95 + Math.sin(t * 2) * 0.05;
        body.rotation.x = -0.3;
        arms[0].rotation.x = -2.2 + Math.sin(t * 4) * 0.5;
        arms[1].rotation.x = -2.2 - Math.sin(t * 4) * 0.5;
        arms[0].rotation.z = -0.4;
        arms[1].rotation.z = 0.4;
        break;
      case 'cheer':
        body.position.y = Math.abs(Math.sin(t * 6)) * 0.25;
        arms[0].rotation.z = -2.7 + Math.sin(t * 12) * 0.2;
        arms[1].rotation.z = 2.7 - Math.sin(t * 12) * 0.2;
        head.rotation.x = -0.2;
        break;
      case 'throw': {
        const c = (t * 2.2) % 1;
        arms[1].rotation.x = c < 0.5 ? -c * 5 : -2.5 + (c - 0.5) * 7;
        torso.rotation.y = c < 0.5 ? -0.4 : 0.4;
        legs[0].rotation.x = -0.3;
        break;
      }
      case 'think':
        arms[1].rotation.x = -2.2;
        arms[1].rotation.z = 0.5;
        head.rotation.x = 0.15;
        head.rotation.z = Math.sin(t * 1.2) * 0.1;
        torso.rotation.x = 0.1;
        break;
      case 'sad':
        head.rotation.x = 0.5;
        torso.rotation.x = 0.2;
        arms[0].rotation.z = 0.05;
        arms[1].rotation.z = -0.05;
        break;
      case 'sit':
        body.position.y = -0.45;
        legs[0].rotation.x = -1.5;
        legs[1].rotation.x = -1.5;
        arms[0].rotation.x = -0.6;
        arms[1].rotation.x = -0.6;
        break;
    }
  };

  const original = materials.map((x) => x.color.clone());
  const setGray = (gray: boolean) => {
    materials.forEach((x, i) => {
      if (gray) {
        const c = original[i];
        const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
        x.color.setRGB(l * 0.7, l * 0.7, l * 0.75);
      } else x.color.copy(original[i]);
    });
  };

  const dispose = () => {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    materials.forEach((x) => x.dispose());
  };

  setPose('idle', 0);
  return { root, body, setPose, setGray, dispose };
}

/** Étiquette flottante (nom) au-dessus d'un personnage. */
export function createNameTag(text: string, color: string, highlight = false): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 30px Fredoka, system-ui, sans-serif';
  const w = Math.min(248, ctx.measureText(text).width + 34);
  ctx.fillStyle = highlight ? '#fbbf24' : 'rgba(15,23,42,.85)';
  ctx.beginPath();
  ctx.roundRect((256 - w) / 2, 8, w, 46, 23);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc((256 - w) / 2 + 20, 31, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = highlight ? '#0f172a' : '#f8fafc';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, (256 - w) / 2 + 34, 32, w - 40);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.6, 0.4, 1);
  sprite.renderOrder = 10;
  return sprite;
}
