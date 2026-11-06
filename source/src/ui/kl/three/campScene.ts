import * as THREE from 'three';
import { createAvatar, createNameTag, type Avatar } from './avatar';
import { createWorld, lowPoly, type World } from './world';

export interface CampMember {
  id: number;
  name: string;
  skin: number;
  teamColor: string;
  diseases: number;
  active: boolean;
}

export interface CampScene {
  world: World;
  setState: (s: { fire: boolean; night: boolean; members: CampMember[]; council: boolean }) => void;
  dispose: () => void;
}

/** Diorama du camp : cabane, feu (allumé ou non), aventuriers autour. */
export function createCampScene(container: HTMLElement): CampScene {
  const world = createWorld(container, { islandRadius: 16, palms: 9 });
  const { scene, camera } = world;
  camera.position.set(0, 5.5, 11);
  camera.lookAt(0, 0.8, 0);

  // Cabane
  const hut = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 3), lowPoly('#a16207'));
  floor.position.y = 0.5;
  hut.add(floor);
  for (const [x, z] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), lowPoly('#78350f'));
    post.position.set(x, 1.3, z);
    hut.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.6, 4), lowPoly('#ca8a04'));
  roof.position.y = 3.2;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  hut.add(roof);
  hut.position.set(-3.5, 0, -3.5);
  hut.rotation.y = 0.4;
  scene.add(hut);

  // Foyer
  const pit = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), lowPoly('#78716c'));
    stone.position.set(Math.cos((i / 9) * Math.PI * 2) * 0.65, 0.1, Math.sin((i / 9) * Math.PI * 2) * 0.65);
    pit.add(stone);
  }
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), lowPoly('#5b3a1a'));
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 4) * Math.PI;
    log.position.y = 0.12;
    pit.add(log);
  }
  const flames: THREE.Mesh[] = [];
  const flameColors = ['#f97316', '#facc15', '#ef4444'];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.06, 0.9 - i * 0.15, 6), new THREE.MeshBasicMaterial({ color: flameColors[i], transparent: true, opacity: 0.9 }));
    f.position.y = 0.55;
    pit.add(f);
    flames.push(f);
  }
  const fireLight = new THREE.PointLight('#fb923c', 0, 12, 1.6);
  fireLight.position.y = 1.2;
  pit.add(fireLight);
  scene.add(pit);

  // Torches du conseil
  const torches: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const torch = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6), lowPoly('#78350f'));
    stick.position.y = 0.8;
    torch.add(stick);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), new THREE.MeshBasicMaterial({ color: '#fb923c' }));
    flame.position.y = 1.75;
    torch.add(flame);
    const a = (i / 6) * Math.PI + Math.PI;
    torch.position.set(Math.cos(a) * 4.2, 0, Math.sin(a) * 2.2 - 0.5);
    torch.visible = false;
    scene.add(torch);
    torches.push(torch);
  }

  const camBase = new THREE.Vector3(0, 5.5, 11);
  const camLook = new THREE.Vector3(0, 0.8, 0);
  world.onFrame(() => {
    const k = Math.max(1, 1.6 / camera.aspect);
    camera.position.copy(camLook).addScaledVector(camBase.clone().sub(camLook), k);
    camera.lookAt(camLook);
  });
  let avatars: { a: Avatar; m: CampMember }[] = [];
  let fireOn = false;
  world.onFrame((t) => {
    flames.forEach((f, i) => {
      f.visible = fireOn;
      f.scale.y = 1 + Math.sin(t * 9 + i * 2) * 0.18;
      f.scale.x = f.scale.z = 1 + Math.cos(t * 7 + i) * 0.1;
    });
    fireLight.intensity = fireOn ? 6 + Math.sin(t * 13) * 1.5 : 0;
    torches.forEach((tc, i) => (tc.children[1].scale.y = 1 + Math.sin(t * 10 + i) * 0.25));
    avatars.forEach(({ a, m }, i) => a.setPose(m.diseases >= 2 ? 'sit' : m.active ? 'cheer' : m.diseases ? 'sad' : 'idle', t + i * 0.4));
  });

  let key = '';
  const setState: CampScene['setState'] = ({ fire, night, members, council }) => {
    fireOn = fire;
    world.setNight(night);
    torches.forEach((tc) => (tc.visible = council));
    const k = members.map((m) => `${m.id}:${m.diseases}:${m.active}`).join('|');
    if (k === key) return;
    key = k;
    avatars.forEach(({ a }) => {
      scene.remove(a.root);
      a.dispose();
    });
    const n = members.length;
    avatars = members.map((m, i) => {
      const a = createAvatar(m.skin, m.teamColor);
      const ang = n === 1 ? Math.PI / 2 : Math.PI * 0.15 + (i / Math.max(1, n - 1)) * Math.PI * 0.7;
      const r = 2.2 + (n > 8 ? (i % 2) * 0.9 : 0);
      a.root.position.set(Math.cos(ang) * r * 1.4, 0, Math.sin(ang) * r);
      a.root.lookAt(0, 0, 0);
      const tag = createNameTag(m.name, m.teamColor, m.active);
      tag.position.y = 2.4;
      a.root.add(tag);
      scene.add(a.root);
      return { a, m };
    });
  };

  return {
    world,
    setState,
    dispose: () => {
      avatars.forEach(({ a }) => a.dispose());
      world.dispose();
    },
  };
}
