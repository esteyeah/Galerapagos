import type { CardType } from './types';

export type CardContext = 'turn' | 'contribute' | 'departure' | 'passive' | 'vote';

export interface CardDef {
  type: CardType;
  name: string;
  emoji: string;
  description: string;
  /** Moments où la carte peut être jouée activement. */
  contexts: CardContext[];
  /** Nombre d'exemplaires dans le paquet de l'épave. */
  copies: number;
  needsTarget?: boolean;
  /** Valeur indicative (utilisée par les bots pour échanger). */
  value: number;
  /** Carte retirée du paquet en mode sans météo. */
  weatherOnly?: boolean;
}

export const CARD_DEFS: Record<CardType, CardDef> = {
  gourde: { type: 'gourde', name: 'Gourde', emoji: '🧴', description: '+2 eau dans la réserve commune.', contexts: ['turn', 'contribute', 'departure'], copies: 6, value: 3 },
  conserve: { type: 'conserve', name: 'Boîte de conserve', emoji: '🥫', description: '+2 nourriture dans la réserve commune.', contexts: ['turn', 'contribute', 'departure'], copies: 6, value: 3 },
  coco: { type: 'coco', name: 'Noix de coco', emoji: '🥥', description: '+1 eau et +1 nourriture.', contexts: ['turn', 'contribute', 'departure'], copies: 5, value: 3 },
  planches: { type: 'planches', name: 'Planches clouées', emoji: '🪵', description: '+2 bois pour le radeau.', contexts: ['turn', 'departure'], copies: 4, value: 3 },
  bateau: { type: 'bateau', name: 'Bateau gonflable troué', emoji: '🛶', description: 'Inutile seul… mais réparé avec du scotch, il compte comme une place de radeau !', contexts: ['turn', 'departure'], copies: 1, value: 4 },
  scotch: { type: 'scotch', name: 'Rouleau de scotch', emoji: '🩹', description: 'De quoi réparer un bateau gonflable troué : ensemble, ils font une place de radeau.', contexts: ['turn', 'departure'], copies: 1, value: 4 },
  cafe: { type: 'cafe', name: 'Café noir', emoji: '☕', description: 'Effectuez une action supplémentaire ce tour-ci.', contexts: ['turn'], copies: 3, value: 2 },
  soins: { type: 'soins', name: 'Trousse de secours', emoji: '💊', description: 'Soigne une maladie (vous ou un autre joueur).', contexts: ['turn'], copies: 4, value: 4, needsTarget: true },
  longuevue: { type: 'longuevue', name: 'Longue-vue', emoji: '🔭', description: 'Regardez secrètement les 2 prochaines cartes météo.', contexts: ['turn'], copies: 2, value: 1, weatherOnly: true },
  fusil: { type: 'fusil', name: 'Fusil', emoji: '🔫', description: 'Pendant un vote, avec une cartouche : abattez un joueur et récupérez ses cartes.', contexts: ['vote'], copies: 1, value: 4 },
  cartouche: { type: 'cartouche', name: 'Cartouche', emoji: '🧨', description: 'Munition pour le fusil (consommée au tir).', contexts: ['passive'], copies: 3, value: 1 },
  tole: { type: 'tole', name: 'Plaque de tôle', emoji: '🛡️', description: 'Protège d\'une désignation au vote ou d\'une balle (usage unique).', contexts: ['passive'], copies: 2, value: 4 },
  hache: { type: 'hache', name: 'Hache', emoji: '🪓', description: 'Outil : +1 bois quand votre coupe réussit.', contexts: ['passive'], copies: 2, value: 3 },
  canne: { type: 'canne', name: 'Canne à pêche', emoji: '🎣', description: 'Outil : +1 poisson quand votre pêche réussit.', contexts: ['passive'], copies: 2, value: 3 },
  bache: { type: 'bache', name: 'Bâche', emoji: '⛺', description: 'Outil : +1 eau quand votre collecte réussit.', contexts: ['passive'], copies: 2, value: 3 },
};

export const CONTRIBUTION_VALUE: Partial<Record<CardType, { water: number; food: number; wood: number }>> = {
  gourde: { water: 2, food: 0, wood: 0 },
  conserve: { water: 0, food: 2, wood: 0 },
  coco: { water: 1, food: 1, wood: 0 },
  planches: { water: 0, food: 0, wood: 2 },
};

export const WOOD_PER_PLACE = 4;

export function canPlayIn(type: CardType, ctx: CardContext): boolean {
  return CARD_DEFS[type].contexts.includes(ctx);
}
