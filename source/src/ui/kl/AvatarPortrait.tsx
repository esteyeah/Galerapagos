import { skinOf } from './skins';

/** Portrait 2D (SVG) d'un aventurier, cohérent avec son personnage 3D. */
export default function AvatarPortrait({ skin, team, size = 44, dead = false, title }: { skin: number; team?: string; size?: number; dead?: boolean; title?: string }) {
  const s = skinOf(skin);
  const hair = s.hair;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={title ?? s.name} style={{ filter: dead ? 'grayscale(1) opacity(.55)' : undefined, flexShrink: 0 }}>
      <circle cx="32" cy="32" r="31" fill={team ?? '#334155'} />
      <circle cx="32" cy="32" r="27" fill="#0f172a" opacity=".35" />
      {/* épaules */}
      <path d="M10 64 C12 48 22 44 32 44 C42 44 52 48 54 64 Z" fill={s.top} />
      {/* cou + tête */}
      <rect x="27" y="36" width="10" height="9" rx="3" fill={s.skin} />
      {s.hairStyle === 'long' && <path d="M17 30 C17 14 47 14 47 30 L48 46 L16 46 Z" fill={hair} />}
      <ellipse cx="32" cy="28" rx="12.5" ry="14" fill={s.skin} />
      {s.hairStyle === 'court' && <path d="M19 26 C19 12 45 12 45 26 C42 20 22 20 19 26 Z" fill={hair} />}
      {s.hairStyle === 'long' && <path d="M19 27 C19 12 45 12 45 27 C40 19 24 19 19 27 Z" fill={hair} />}
      {s.hairStyle === 'chignon' && (
        <>
          <path d="M19 26 C19 13 45 13 45 26 C42 19 22 19 19 26 Z" fill={hair} />
          <circle cx="32" cy="11" r="6" fill={hair} />
        </>
      )}
      {s.hairStyle === 'queue' && (
        <>
          <path d="M19 26 C19 13 45 13 45 26 C42 19 22 19 19 26 Z" fill={hair} />
          <path d="M44 22 C54 26 52 40 47 44 C49 34 47 28 43 26 Z" fill={hair} />
        </>
      )}
      {s.hairStyle === 'boucles' && [18, 24, 30, 36, 42, 46, 16].map((x, i) => <circle key={i} cx={x} cy={i === 6 ? 26 : i === 5 ? 24 : 17 - (i % 2) * 2} r="5.5" fill={hair} />)}
      {s.hairStyle === 'crete' && <path d="M28 6 L36 6 L35 22 L29 22 Z" fill={hair} />}
      {s.hairStyle === 'rase' && <path d="M20 24 C21 14 43 14 44 24 C40 19 24 19 20 24 Z" fill={hair} opacity=".55" />}
      {/* visage */}
      <circle cx="27" cy="29" r="1.8" fill="#111" />
      <circle cx="37" cy="29" r="1.8" fill="#111" />
      <path d="M27.5 35 Q32 38.5 36.5 35" stroke="#111" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {s.accessory === 'barbe' && <path d="M20 31 C21 44 43 44 44 31 C41 40 23 40 20 31 Z" fill={hair} />}
      {s.accessory === 'moustache' && <path d="M26 33.5 Q32 31 38 33.5 Q32 35 26 33.5 Z" fill={hair} />}
      {s.accessory === 'lunettes' && (
        <g stroke="#111" strokeWidth="1.5" fill="none">
          <circle cx="27" cy="29" r="4" />
          <circle cx="37" cy="29" r="4" />
          <path d="M31 29 L33 29" />
        </g>
      )}
      {s.accessory === 'chapeau' && (
        <>
          <ellipse cx="32" cy="17" rx="20" ry="4" fill="#a16207" />
          <path d="M22 17 C22 6 42 6 42 17 Z" fill="#ca8a04" />
        </>
      )}
      {/* bandana d'équipe */}
      {s.accessory !== 'chapeau' && <path d="M19.5 21 C25 18 39 18 44.5 21 L44 24 C38 21.5 26 21.5 20 24 Z" fill={team ?? '#f97316'} stroke="#0003" strokeWidth=".5" />}
      {dead && <text x="32" y="40" textAnchor="middle" fontSize="22">🔥</text>}
    </svg>
  );
}
