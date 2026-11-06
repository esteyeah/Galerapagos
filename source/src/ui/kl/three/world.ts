import * as THREE from 'three';

export interface World {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  water: THREE.Mesh;
  onFrame: (fn: (t: number, dt: number) => void) => void;
  setNight: (night: boolean) => void;
  dispose: () => void;
}

const lowPoly = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });

function skyTexture(top: string, bottom: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createPalm(height = 4, lean = 0.25): THREE.Group {
  const palm = new THREE.Group();
  const trunkM = lowPoly('#8b5a2b');
  const leafM = new THREE.MeshStandardMaterial({ color: '#2f9e44', roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
  const segs = 6;
  let x = 0;
  for (let i = 0; i < segs; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13 - i * 0.01, 0.16 - i * 0.01, height / segs + 0.05, 6), trunkM);
    x += lean * (i / segs) * 0.35;
    seg.position.set(x, (i + 0.5) * (height / segs), 0);
    seg.rotation.z = -lean * 0.3;
    seg.castShadow = true;
    palm.add(seg);
  }
  const top = new THREE.Vector3(x, height, 0);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 3, 1, true), leafM);
    leaf.geometry.translate(0, 1.1, 0);
    leaf.scale.z = 0.25;
    leaf.position.copy(top);
    leaf.rotation.set(0, (i / 7) * Math.PI * 2, 1.2 + Math.sin(i) * 0.15);
    leaf.rotation.order = 'YZX';
    leaf.castShadow = true;
    palm.add(leaf);
  }
  for (let i = 0; i < 3; i++) {
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), lowPoly('#5b3a1a'));
    coco.position.set(top.x + Math.cos(i * 2) * 0.15, height - 0.15, Math.sin(i * 2) * 0.15);
    palm.add(coco);
  }
  return palm;
}

/** Monde 3D de base : mer animée, île de sable, cocotiers, ciel et lumière. */
export function createWorld(container: HTMLElement, opts: { islandRadius?: number; ground?: string; palms?: number; islandZ?: number } = {}): World {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';

  const scene = new THREE.Scene();
  const daySky = skyTexture('#38bdf8', '#fde68a');
  const nightSky = skyTexture('#020617', '#1e1b4b');
  scene.background = daySky;
  scene.fog = new THREE.Fog('#bae6fd', 40, 120);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
  camera.position.set(0, 10, 22);
  camera.lookAt(0, 1, 0);

  const hemi = new THREE.HemisphereLight('#e0f2fe', '#a16207', 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff7e6', 2.4);
  sun.position.set(18, 30, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -30;
  sc.right = 30;
  sc.top = 30;
  sc.bottom = -30;
  scene.add(sun);

  // Mer animée
  const waterGeo = new THREE.PlaneGeometry(300, 300, 90, 90);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: '#0ea5e9', roughness: 0.25, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.92 }));
  water.receiveShadow = true;
  scene.add(water);
  const base = (waterGeo.attributes.position.array as Float32Array).slice();

  // Île
  const r = opts.islandRadius ?? 26;
  const island = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 6, 2, 28, 1), lowPoly(opts.ground ?? '#f5d99a'));
  island.position.set(0, -0.95, opts.islandZ ?? 0);
  island.receiveShadow = true;
  scene.add(island);
  for (let i = 0; i < (opts.palms ?? 10); i++) {
    // cocotiers à l'arrière-plan (la caméra regarde depuis l'avant)
    const a = Math.PI * 1.05 + (i / Math.max(1, (opts.palms ?? 10) - 1)) * Math.PI * 0.9;
    const palm = createPalm(3.5 + (i % 3) * 0.7, 0.2 + (i % 4) * 0.08);
    palm.position.set(Math.cos(a) * (r - 3), 0, Math.sin(a) * (r - 3) + (opts.islandZ ?? 0) - (opts.islandZ ? 0 : 6));
    palm.rotation.y = -a;
    scene.add(palm);
  }

  const callbacks: ((t: number, dt: number) => void)[] = [];
  const clock = new THREE.Clock();
  let raf = 0;
  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const pos = waterGeo.attributes.position;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i];
      const z = base[i + 2];
      arr[i + 1] = -0.3 + Math.sin(x * 0.18 + t * 1.2) * 0.12 + Math.cos(z * 0.21 + t * 0.9) * 0.12;
    }
    pos.needsUpdate = true;
    for (const cb of callbacks) cb(t, dt);
    renderer.render(scene, camera);
  };
  loop();

  return {
    renderer,
    scene,
    camera,
    sun,
    water,
    onFrame: (fn) => callbacks.push(fn),
    setNight: (night) => {
      scene.background = night ? nightSky : daySky;
      (scene.fog as THREE.Fog).color.set(night ? '#0b1026' : '#bae6fd');
      hemi.intensity = night ? 0.25 : 1.1;
      sun.intensity = night ? 0.15 : 2.4;
      sun.color.set(night ? '#93c5fd' : '#fff7e6');
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mm = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(mm) ? mm : [mm]).forEach((x) => x.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export { lowPoly };
