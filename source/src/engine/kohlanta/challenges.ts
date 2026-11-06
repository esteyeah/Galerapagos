import type { ChallengeId } from './types';
import type { Rng } from '../rng';

export type ChallengeStyle = 'race' | 'endurance' | 'score';

export interface ChallengeDef {
  id: ChallengeId;
  name: string;
  emoji: string;
  category: 'Sport' | 'Logique' | 'Mixte' | 'Équilibre' | 'Adresse' | 'Mémoire';
  style: ChallengeStyle;
  /** Durée maximale (secondes). */
  duration: number;
  description: string;
  controls: string;
  /** Épreuve réservée à la finale. */
  finalOnly?: boolean;
}

export const CHALLENGES: Record<ChallengeId, ChallengeDef> = {
  parcours: {
    id: 'parcours',
    name: 'Parcours du combattant',
    emoji: '🏃',
    category: 'Sport',
    style: 'race',
    duration: 70,
    description: 'Course d’obstacles sur la plage : haies, filets et poutres. Le premier arrivé l’emporte.',
    controls: 'Appuyez en rythme (alternez ← et →, ou les deux boutons) pour courir, et sautez (Espace / bouton Sauter) quand un obstacle arrive dans la zone verte.',
  },
  paresseux: {
    id: 'paresseux',
    name: 'Épreuve du paresseux',
    emoji: '🦥',
    category: 'Équilibre',
    style: 'endurance',
    duration: 120,
    description: 'Suspendus sous un tronc au-dessus du lagon, les aventuriers tiennent à la force des bras. Le dernier accroché gagne.',
    controls: 'Gardez le curseur d’équilibre au centre avec ← et → (ou les boutons). Appuyez sur « Raffermir » quand votre prise faiblit.',
  },
  poteaux: {
    id: 'poteaux',
    name: 'Les poteaux',
    emoji: '🪵',
    category: 'Équilibre',
    style: 'endurance',
    duration: 150,
    description: 'Debout sur un poteau planté dans le lagon. Changements de pied imposés, vent, fatigue… Le dernier debout gagne.',
    controls: 'Gardez l’équilibre avec ← et →. Quand l’ordre « Changez de pied ! » apparaît, appuyez vite sur le bon bouton.',
    finalOnly: true,
  },
  orientation: {
    id: 'orientation',
    name: "Course d'orientation",
    emoji: '🧭',
    category: 'Mixte',
    style: 'race',
    duration: 120,
    description: 'Trouvez les balises cachées dans la jungle grâce aux indices et à la boussole. Le dernier arrivé est éliminé.',
    controls: 'Lisez l’indice, puis touchez la bonne case de la carte. Une erreur coûte du temps.',
    finalOnly: true,
  },
  totems: {
    id: 'totems',
    name: 'La mémoire des totems',
    emoji: '🗿',
    category: 'Mémoire',
    style: 'endurance',
    duration: 120,
    description: 'Les totems s’illuminent dans un ordre secret, de plus en plus long. Une erreur et vous êtes éliminé.',
    controls: 'Regardez la séquence, puis reproduisez-la en touchant les totems.',
  },
  cocos: {
    id: 'cocos',
    name: 'Lancer de noix de coco',
    emoji: '🥥',
    category: 'Adresse',
    style: 'score',
    duration: 60,
    description: 'Dix lancers pour faire tomber les cibles. Dosage de la force et précision sont la clé.',
    controls: 'Appuyez une fois pour fixer la direction, une seconde fois pour fixer la force.',
  },
  puzzle: {
    id: 'puzzle',
    name: 'Le puzzle des sables',
    emoji: '🧩',
    category: 'Logique',
    style: 'race',
    duration: 120,
    description: 'Remettez dans l’ordre les pièces d’un totem sculpté. Le premier qui termine gagne.',
    controls: 'Touchez deux pièces pour les échanger.',
  },
};

export const REGULAR_CHALLENGES: ChallengeId[] = ['parcours', 'paresseux', 'totems', 'cocos', 'puzzle'];

/** État en direct d'un participant pendant une épreuve. */
export interface ChallengeState {
  /** Avancement 0..1 (course), ou temps tenu / durée (endurance), ou score/max (score). */
  progress: number;
  done: boolean;
  /** Éliminé / tombé. */
  fallen: boolean;
  /** Temps (s) d'arrivée ou de chute. */
  time: number;
  score: number;
  /** Petite info pour l'animation (saut, déséquilibre…). */
  pose?: 'jump' | 'wobble' | 'throw' | 'think' | 'stun';
  balance?: number;
}

export const IDLE_STATE: ChallengeState = { progress: 0, done: false, fallen: false, time: 0, score: 0 };

/** Score final servant au classement (plus grand = meilleur). */
export function finalScore(def: ChallengeDef, s: ChallengeState): number {
  if (def.style === 'race') return s.done ? 1000 - s.time : s.progress * 100;
  if (def.style === 'endurance') return s.fallen ? s.time : def.duration + 1 + s.score * 0.01;
  return s.score;
}

/**
 * Performance simulée d'un bot (0..1+), d'après sa forme et un peu de hasard.
 * Retourne une fonction donnant son état à l'instant t (secondes).
 */
export function botPlan(def: ChallengeDef, forme: number, rng: Rng): (t: number) => ChallengeState {
  const perf = Math.max(0.25, 0.55 + forme * 0.04 + (rng() - 0.5) * 0.35);
  if (def.style === 'race') {
    const finish = Math.min(def.duration * 1.4, (def.duration * 0.55) / perf);
    const wobble = rng() * 6;
    return (t) => {
      const raw = t / finish + Math.sin(t * 0.7 + wobble) * 0.012;
      const progress = Math.max(0, Math.min(1, raw));
      const done = t >= finish && finish <= def.duration;
      const stun = Math.sin(t * 1.3 + wobble) > 0.985;
      return { progress: done ? 1 : Math.min(progress, 0.99), done, fallen: false, time: done ? finish : t, score: 0, pose: stun ? 'stun' : Math.sin(t * 2 + wobble) > 0.9 ? 'jump' : undefined };
    };
  }
  if (def.style === 'endurance') {
    const fallAt = Math.min(def.duration + 5, def.duration * Math.pow(perf, 2.2) * (0.6 + rng() * 0.6));
    return (t) => {
      const fallen = t >= fallAt && fallAt < def.duration;
      return { progress: Math.min(1, Math.min(t, fallAt) / def.duration), done: fallen, fallen, time: fallen ? fallAt : t, score: 0, balance: Math.sin(t * (1 + perf)) * (1 - perf * 0.6) * 0.8, pose: !fallen && fallAt - t < 3 ? 'wobble' : undefined };
    };
  }
  // score : dix lancers répartis sur la durée
  const throws: number[] = Array.from({ length: 10 }, () => (rng() < 0.35 + perf * 0.4 ? (rng() < perf * 0.5 ? 3 : 1) : 0));
  return (t) => {
    const n = Math.min(10, Math.floor(t / (def.duration / 11)));
    const score = throws.slice(0, n).reduce((a, b) => a + b, 0);
    return { progress: n / 10, done: n >= 10, fallen: false, time: t, score, pose: (t % (def.duration / 11)) < 0.6 ? 'throw' : undefined };
  };
}
