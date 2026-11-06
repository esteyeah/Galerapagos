import type { KLItemType, RewardId } from './types';

export interface KLItemDef {
  type: KLItemType;
  name: string;
  emoji: string;
  description: string;
  copies: number;
  /** Se joue pendant sa vie de camp (sinon : effet passif ou carte de conseil). */
  playable: boolean;
  needsTarget?: boolean;
}

export const KL_ITEMS: Record<KLItemType, KLItemDef> = {
  riz: { type: 'riz', name: 'Sac de riz', emoji: '🍚', description: '+2 nourriture pour votre équipe.', copies: 4, playable: true },
  fruits: { type: 'fruits', name: 'Fruits sauvages', emoji: '🥭', description: '+1 eau et +1 nourriture pour votre équipe.', copies: 5, playable: true },
  gourde: { type: 'gourde', name: 'Gourde', emoji: '🧴', description: '+2 eau pour votre équipe.', copies: 4, playable: true },
  energie: { type: 'energie', name: 'Barre énergétique', emoji: '🍫', description: '+3 de forme pour vous.', copies: 3, playable: true },
  soins: { type: 'soins', name: 'Trousse de secours', emoji: '💊', description: 'Soigne une maladie (vous ou un coéquipier).', copies: 3, playable: true, needsTarget: true },
  silex: { type: 'silex', name: 'Pierre à feu', emoji: '🔥', description: "Allume le feu du camp à coup sûr (il faut 1 bois).", copies: 3, playable: true },
  machette: { type: 'machette', name: 'Machette', emoji: '🔪', description: 'Outil : +1 bois quand votre coupe réussit.', copies: 2, playable: false },
  masque: { type: 'masque', name: 'Masque et tuba', emoji: '🤿', description: 'Outil : +1 poisson quand votre pêche réussit.', copies: 2, playable: false },
  bache: { type: 'bache', name: 'Bâche', emoji: '⛺', description: 'Outil : +1 eau quand votre collecte réussit.', copies: 2, playable: false },
  collier: { type: 'collier', name: "Collier d'immunité", emoji: '📿', description: 'À jouer pendant votre vote au conseil : les voix contre vous sont annulées.', copies: 2, playable: false },
};

export interface RewardDef {
  id: RewardId;
  label: string;
  emoji: string;
  description: string;
}

export const REWARDS: Record<RewardId, RewardDef> = {
  vivres: { id: 'vivres', label: 'Panier de vivres', emoji: '🧺', description: '+4 nourriture et +2 eau' },
  peche: { id: 'peche', label: 'Kit de pêche', emoji: '🎣', description: '+3 nourriture et un masque & tuba' },
  feu: { id: 'feu', label: 'Kit de feu', emoji: '🔥', description: '+3 bois et une pierre à feu' },
  repos: { id: 'repos', label: 'Nuit au calme', emoji: '🛏️', description: '+3 de forme pour chaque gagnant' },
  soins: { id: 'soins', label: 'Visite du médecin', emoji: '🩺', description: 'Chaque gagnant guérit une maladie et gagne +1 forme' },
  eau: { id: 'eau', label: "Bidons d'eau potable", emoji: '💧', description: '+5 eau' },
};
