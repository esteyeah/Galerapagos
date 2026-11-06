import { MAX_DISEASES } from '../../engine';

/** Jauge de santé : un cœur vert par point de santé, un visage malade par maladie. */
export function HealthPips({ diseases, size = 'text-lg' }: { diseases: number; size?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${size}`} aria-label={`${diseases} maladie(s) sur ${MAX_DISEASES}`} title={`${diseases} maladie(s) sur ${MAX_DISEASES} : à ${MAX_DISEASES}, c'est la mort`}>
      {Array.from({ length: MAX_DISEASES }, (_, i) => (
        <span key={i} className={i < diseases ? 'drop-shadow-[0_0_6px_rgba(163,230,53,.9)]' : 'opacity-90'}>
          {i < diseases ? '🤢' : '💚'}
        </span>
      ))}
    </span>
  );
}

/** Bandeau d'état bien visible pour un joueur malade. */
export function SickBadge({ diseases }: { diseases: number }) {
  if (diseases <= 0) return null;
  const critical = diseases >= MAX_DISEASES - 1;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
        critical ? 'animate-pulse bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,.7)]' : 'bg-lime-400 text-slate-900'
      }`}
    >
      🤒 {critical ? 'Danger de mort' : 'Malade'}
    </span>
  );
}
