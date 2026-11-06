import type { Card, CardType, Personality } from './types';

export const PLAYER_COLORS = ['#f97316', '#22d3ee', '#a3e635', '#f472b6', '#facc15', '#a78bfa', '#34d399', '#f87171'];
export const MAX_DISEASES = 2;

export class Player {
  alive = true;
  /** Nombre de maladies : à 2, le joueur meurt. */
  diseases = 0;
  hand: Card[] = [];
  deathDay?: number;
  deathCause?: string;
  /** Unités (eau/nourriture/bois) données publiquement à la tribu via des cartes. */
  contributed = 0;

  constructor(
    public readonly id: number,
    public name: string,
    public isBot: boolean,
    public readonly personality: Personality,
    public readonly color: string,
  ) {}

  get sick(): boolean {
    return this.diseases > 0;
  }

  has(type: CardType): boolean {
    return this.hand.some((c) => c.type === type);
  }

  count(type: CardType): number {
    return this.hand.filter((c) => c.type === type).length;
  }

  find(type: CardType): Card | undefined {
    return this.hand.find((c) => c.type === type);
  }

  getCard(cardId: string): Card | undefined {
    return this.hand.find((c) => c.id === cardId);
  }

  addCard(card: Card): void {
    this.hand.push(card);
  }

  removeCard(cardId: string): Card | undefined {
    const idx = this.hand.findIndex((c) => c.id === cardId);
    if (idx === -1) return undefined;
    return this.hand.splice(idx, 1)[0];
  }

  removeType(type: CardType): Card | undefined {
    const card = this.find(type);
    return card ? this.removeCard(card.id) : undefined;
  }

  canShoot(): boolean {
    return this.has('fusil') && this.has('cartouche');
  }
}
