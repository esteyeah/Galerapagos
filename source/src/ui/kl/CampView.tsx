import { useEffect, useRef, useState } from 'react';
import { createCampScene, type CampMember, type CampScene } from './three/campScene';

/** Diorama 3D du camp (repli en 2D si WebGL est indisponible). */
export default function CampView({ fire, night, council, members, label }: { fire: boolean; night: boolean; council: boolean; members: CampMember[]; label: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const scene = useRef<CampScene | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!mount.current) return;
    try {
      scene.current = createCampScene(mount.current);
    } catch {
      setFailed(true);
    }
    return () => {
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  useEffect(() => {
    scene.current?.setState({ fire, night, council, members });
  }, [fire, night, council, members]);
  return (
    <div className="panel relative h-56 overflow-hidden sm:h-72">
      <div ref={mount} className="absolute inset-0" />
      {failed && <div className="flex h-full items-center justify-center text-6xl">{fire ? '🔥' : '🪵'} 🛖 🌴</div>}
      <div className="absolute left-3 top-3 rounded-xl bg-slate-950/70 px-3 py-1.5 text-sm font-semibold backdrop-blur">{label}</div>
      <div className={`absolute right-3 top-3 rounded-xl px-3 py-1.5 text-sm font-bold backdrop-blur ${fire ? 'bg-orange-500/80 text-white' : 'bg-slate-950/70 text-slate-300'}`}>{fire ? '🔥 Feu allumé' : '🪵 Pas de feu'}</div>
    </div>
  );
}
