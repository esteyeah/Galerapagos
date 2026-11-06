import * as THREE from 'three';
import type { ChallengeId, ChallengeState } from '../../../engine/kohlanta';
import { createAvatar, createNameTag, type Avatar, type Pose } from './avatar';
import { createPalm, createWorld, lowPoly, type World } from './world';

export interface SceneParticipant {
  id: number;
  name: string;
  skin: number;
  teamColor: string;
  isMe: boolean;
}

interface Actor {
  p: SceneParticipant;
  avatar: Avatar;
  tag: THREE.Sprite;
  ring?: THREE.Mesh;
  x: number;
  lastScore: number;
  fallT: number | null;
}

export interface ChallengeScene {
  world: World;
  update: (states: Record<number, ChallengeState | undefined>) => void;
  dispose: () => void;
}

const WORLD_OPTS: Record<ChallengeId, Parameters<typeof createWorld>[1]> = {
  parcours: { islandRadius: 30, palms: 12 },
  paresseux: { islandRadius: 9, islandZ: -26, palms: 5 },
  poteaux: { islandRadius: 9, islandZ: -26, palms: 5 },
  orientation: { islandRadius: 34, ground: '#4d7c3a', palms: 22 },
  totems: { islandRadius: 28, palms: 10 },
  cocos: { islandRadius: 28, palms: 10 },
  puzzle: { islandRadius: 28, palms: 10 },
};

/** Construit la scène 3D d'une épreuve avec tous les participants visibles. */
export function createChallengeScene(container: HTMLElement, game: ChallengeId, participants: SceneParticipant[]): ChallengeScene {
  const world = createWorld(container, WORLD_OPTS[game]);
  const { scene, camera } = world;
  const n = participants.length;
  const gap = n > 10 ? 1.35 : 1.7;
  const laneZ = (i: number) => (i - (n - 1) / 2) * gap;
  const span = (n - 1) * gap;
  const props: THREE.Object3D[] = [];
  const addProp = (o: THREE.Object3D) => {
    scene.add(o);
    props.push(o);
    return o;
  };
  const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lowPoly(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return addProp(mesh) as THREE.Mesh;
  };
  const cyl = (rt: number, rb: number, h: number, color: string, x: number, y: number, z: number, seg = 8) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), lowPoly(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return addProp(mesh) as THREE.Mesh;
  };

  // ── Décors propres à chaque épreuve ──
  const RACE_START = -16;
  const RACE_END = 16;
  const pathPoints: THREE.Vector3[] = [];
  const cocoTargets: THREE.Mesh[] = [];
  const puzzleTiles: THREE.Mesh[][] = [];
  const flyingCocos: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number }[] = [];

  if (game === 'parcours') {
    for (let i = 0; i < n; i++) {
      box(RACE_END - RACE_START + 4, 0.04, gap * 0.9, i % 2 ? '#e7c98a' : '#dcb874', 0, 0.02, laneZ(i));
      for (const hx of [-10, -4, 2, 8]) box(0.18, 0.55, gap * 0.8, '#92400e', hx, 0.3, laneZ(i));
      box(0.15, 0.15, gap * 0.8, '#a3a3a3', 12, 1.2, laneZ(i)); // filet
    }
    cyl(0.15, 0.15, 4, '#7c2d12', RACE_END, 2, -span / 2 - 1.2);
    cyl(0.15, 0.15, 4, '#7c2d12', RACE_END, 2, span / 2 + 1.2);
    box(0.2, 0.8, span + 2.6, '#facc15', RACE_END, 3.8, 0);
  }
  if (game === 'paresseux') {
    const log = cyl(0.28, 0.28, span + 4, '#78350f', 0, 3.4, 0, 10);
    log.rotation.x = Math.PI / 2;
    for (const z of [-span / 2 - 2, span / 2 + 2]) {
      cyl(0.25, 0.3, 6, '#5b3a1a', 0, 1, z);
    }
  }
  if (game === 'poteaux') {
    for (let i = 0; i < n; i++) cyl(0.32, 0.36, 5, '#8b5a2b', 0, -0.3, laneZ(i), 10);
  }
  if (game === 'orientation') {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-18, 0, 6), new THREE.Vector3(-9, 0, -4), new THREE.Vector3(0, 0, 5), new THREE.Vector3(9, 0, -5), new THREE.Vector3(18, 0, 3)]);
    pathPoints.push(...curve.getPoints(120));
    for (const pnt of curve.getPoints(60)) box(1.2, 0.03, 1.2, '#a8835a', pnt.x, 0.02, pnt.z);
    for (let b = 0; b <= 6; b++) {
      const pt = curve.getPoint(b / 6);
      cyl(0.05, 0.05, 1.6, '#e5e7eb', pt.x + 0.9, 0.8, pt.z);
      const flag = box(0.5, 0.35, 0.03, b % 2 ? '#f97316' : '#ffffff', pt.x + 1.15, 1.4, pt.z);
      flag.rotation.y = 0.2;
    }
    for (let i = 0; i < 14; i++) {
      const palm = createPalm(3 + (i % 3), 0.3);
      palm.position.set(-20 + i * 3.1, 0, i % 2 ? -11 : 12);
      addProp(palm);
    }
  }
  if (game === 'totems') {
    const colors = ['#dc2626', '#2563eb', '#16a34a', '#eab308'];
    colors.forEach((c, i) => {
      const x = -6 + i * 4;
      for (let k = 0; k < 3; k++) box(1.4 - k * 0.15, 1.1, 1.4 - k * 0.15, k === 2 ? c : '#7c4a1e', x, 0.55 + k * 1.1, -7);
      box(0.25, 0.25, 0.1, '#111', x - 0.3, 2.9, -6.3);
      box(0.25, 0.25, 0.1, '#111', x + 0.3, 2.9, -6.3);
    });
  }
  if (game === 'cocos') {
    for (let i = 0; i < n; i++) {
      const target = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.12, 6, 16), lowPoly('#ef4444'));
      target.position.set(9, 1.4, laneZ(i));
      target.rotation.y = Math.PI / 2;
      addProp(target);
      cocoTargets.push(target as THREE.Mesh);
      cyl(0.06, 0.06, 1, '#78350f', 9, 0.5, laneZ(i));
    }
  }
  if (game === 'puzzle') {
    for (let i = 0; i < n; i++) {
      box(1.1, 0.08, 1.1, '#a16207', 1.2, 0.95, laneZ(i));
      cyl(0.05, 0.05, 0.95, '#78350f', 1.2, 0.47, laneZ(i));
      const tiles: THREE.Mesh[] = [];
      for (let k = 0; k < 9; k++) tiles.push(box(0.28, 0.04, 0.28, '#57534e', 1.2 + ((k % 3) - 1) * 0.32, 1.02, laneZ(i) + (Math.floor(k / 3) - 1) * 0.32));
      puzzleTiles.push(tiles);
    }
  }

  // ── Participants ──
  const actors: Actor[] = participants.map((p, i) => {
    const avatar = createAvatar(p.skin, p.teamColor);
    const tag = createNameTag(p.name, p.teamColor, p.isMe);
    tag.position.y = 2.45;
    avatar.root.add(tag);
    let ring: THREE.Mesh | undefined;
    if (p.isMe) {
      ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color: '#fbbf24', side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      avatar.root.add(ring);
    }
    scene.add(avatar.root);
    const z = laneZ(i);
    const start = game === 'cocos' ? -8 : game === 'puzzle' ? 0 : game === 'totems' ? -6 + ((i % 4) * 4) : game === 'paresseux' || game === 'poteaux' ? 0 : RACE_START;
    avatar.root.position.set(start, 0, z);
    if (game === 'parcours' || game === 'orientation' || game === 'cocos') avatar.root.rotation.y = Math.PI / 2;
    if (game === 'puzzle') avatar.root.rotation.y = Math.PI / 2;
    if (game === 'totems') {
      avatar.root.position.set(-7 + (i % 8) * 2, 0, -1 + Math.floor(i / 8) * 2.2);
      avatar.root.rotation.y = Math.PI;
    }
    return { p, avatar, tag, ring, x: start, lastScore: 0, fallT: null };
  });

  // ── Caméra ──
  const camDist = Math.max(14, span * 1.05 + 8);
  const camTargets: Record<ChallengeId, [THREE.Vector3, THREE.Vector3]> = {
    parcours: [new THREE.Vector3(-4, camDist * 0.55, camDist), new THREE.Vector3(0, 0.5, 0)],
    paresseux: [new THREE.Vector3(camDist * 0.85, 4.5, 2), new THREE.Vector3(0, 2, 0)],
    poteaux: [new THREE.Vector3(camDist * 0.85, 5, 2), new THREE.Vector3(0, 2, 0)],
    orientation: [new THREE.Vector3(0, 22, 24), new THREE.Vector3(0, 0, 0)],
    totems: [new THREE.Vector3(0, 6.5, 13), new THREE.Vector3(0, 1.8, -3)],
    cocos: [new THREE.Vector3(-3, camDist * 0.45, camDist * 0.9), new THREE.Vector3(1, 1, 0)],
    puzzle: [new THREE.Vector3(9, camDist * 0.45, camDist * 0.6), new THREE.Vector3(0.5, 1, 0)],
  };
  const [camPos, camLook] = camTargets[game];
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  let time = 0;
  world.onFrame((t, dt) => {
    time = t;
    // écran étroit (téléphone en portrait) : on recule pour garder tout le monde dans le cadre
    const narrow = camera.aspect < 1;
    const k = narrow ? Math.max(1, 0.95 / camera.aspect) : 1;
    camera.position.copy(camLook).addScaledVector(camPos.clone().sub(camLook), k);
    camera.position.x += Math.sin(t * 0.15) * 0.8;
    // en portrait, le panneau de jeu couvre le bas : on vise plus bas pour remonter la scène à l'écran
    if (narrow) camera.lookAt(camLook.x, camLook.y - camPos.distanceTo(camLook) * k * 0.28, camLook.z);
    else camera.lookAt(camLook);
    for (const c of flyingCocos) {
      c.t += dt * 1.6;
      const k = Math.min(1, c.t);
      c.mesh.position.lerpVectors(c.from, c.to, k);
      c.mesh.position.y += Math.sin(k * Math.PI) * 2.2;
      if (k >= 1) c.mesh.visible = false;
    }
    for (const a of actors) if (a.ring) (a.ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 4) * 0.3;
    for (const target of cocoTargets) target.rotation.z += dt * 0.5;
  });

  const update = (states: Record<number, ChallengeState | undefined>) => {
    actors.forEach((a, i) => {
      const s = states[a.p.id];
      const av = a.avatar;
      const z = laneZ(i);
      const progress = s?.progress ?? 0;
      let pose: Pose = 'idle';
      switch (game) {
        case 'parcours': {
          const target = RACE_START + progress * (RACE_END - RACE_START);
          a.x += (target - a.x) * 0.15;
          av.root.position.set(a.x, 0, z);
          pose = s?.done ? 'cheer' : !s || progress === 0 ? 'idle' : s.pose === 'jump' ? 'jump' : s.pose === 'stun' ? 'stun' : 'run';
          break;
        }
        case 'orientation': {
          const idx = Math.min(pathPoints.length - 1, Math.floor(progress * (pathPoints.length - 1)));
          const pt = pathPoints[idx];
          const nx = pathPoints[Math.min(pathPoints.length - 1, idx + 2)];
          const off = (i - (n - 1) / 2) * 0.35;
          av.root.position.lerp(new THREE.Vector3(pt.x, 0, pt.z + off), 0.15);
          if (nx !== pt) av.root.rotation.y = Math.atan2(nx.x - pt.x, nx.z - pt.z);
          pose = s?.done ? 'cheer' : s?.pose === 'stun' ? 'sad' : s?.pose === 'think' ? 'think' : progress > 0 ? 'run' : 'idle';
          break;
        }
        case 'paresseux': {
          if (s?.fallen) {
            if (a.fallT === null) a.fallT = time;
            const k = Math.min(1, (time - a.fallT) * 1.5);
            av.root.position.set(0.8 + k * 1.2, (1 - k) * 0.9, z);
            pose = k < 1 ? 'hang' : 'swim';
          } else {
            av.root.position.set(0, 0.95, z);
            pose = s?.done ? 'cheer' : 'hang';
          }
          break;
        }
        case 'poteaux': {
          if (s?.fallen) {
            if (a.fallT === null) a.fallT = time;
            const k = Math.min(1, (time - a.fallT) * 1.4);
            av.root.position.set(0.9 * k, 2.2 - k * 2.3, z);
            av.root.rotation.z = -k * 1.2;
            pose = k < 1 ? 'balance' : 'swim';
            if (k >= 1) av.root.rotation.z = 0;
          } else {
            av.root.position.set(0, 2.2, z);
            pose = s?.done ? 'cheer' : 'balance';
          }
          break;
        }
        case 'totems':
          pose = s?.fallen ? 'sit' : s?.done ? 'cheer' : progress > 0 ? 'think' : 'idle';
          av.setGray(!!s?.fallen);
          break;
        case 'cocos': {
          av.root.position.set(-8, 0, z);
          const score = s?.score ?? 0;
          if (score !== a.lastScore || (s?.pose === 'throw' && Math.random() < 0.02)) {
            const from = new THREE.Vector3(-7.6, 1.8, z);
            const hit = score > a.lastScore;
            const to = new THREE.Vector3(9, hit ? 1.4 : 0.1, z + (hit ? 0 : (Math.random() - 0.5) * 1.5));
            const coco = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), lowPoly('#5b3a1a'));
            scene.add(coco);
            flyingCocos.push({ mesh: coco, from, to, t: 0 });
            if (hit) {
              const tm = cocoTargets[i].material as THREE.MeshStandardMaterial;
              tm.color.set('#22c55e');
              setTimeout(() => tm.color.set('#ef4444'), 600);
            }
            a.lastScore = score;
          }
          pose = s?.done ? (score >= 8 ? 'cheer' : 'idle') : s?.pose === 'throw' ? 'throw' : 'idle';
          break;
        }
        case 'puzzle': {
          av.root.position.set(0, 0, z);
          const lit = Math.round(progress * 9);
          puzzleTiles[i]?.forEach((tile, k) => (tile.material as THREE.MeshStandardMaterial).color.set(k < lit ? a.p.teamColor : '#57534e'));
          pose = s?.done ? 'cheer' : progress > 0 ? 'think' : 'idle';
          break;
        }
      }
      av.setPose(pose, time + i * 0.37, { balance: s?.balance ?? 0 });
    });
  };

  return {
    world,
    update,
    dispose: () => {
      for (const a of actors) a.avatar.dispose();
      world.dispose();
    },
  };
}
