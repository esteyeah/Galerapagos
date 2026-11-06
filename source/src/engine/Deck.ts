import type { Card, CardType, Difficulty, WeatherCard, WeatherKind } from './types';
import { CARD_DEFS } from './cards';
import { type Rng, shuffle, randInt } from './rng';

/** Pioche générique avec défausse et remélange automatique. */
export class Deck<T> {
  private cards: T[];
  private discardPile: T[] = [];

  constructor(cards: T[], private rng: Rng, private reshuffle = true) {
    this.cards = [...cards];
  }

  get size(): number {
    return this.cards.length;
  }

  shuffle(): this {
    shuffle(this.rng, this.cards);
    return this;
  }

  draw(): T | undefined {
    if (this.cards.length === 0 && this.reshuffle && this.discardPile.length > 0) {
      this.cards = shuffle(this.rng, this.discardPile);
      this.discardPile = [];
    }
    return this.cards.shift();
  }

  peek(n: number): T[] {
    return this.cards.slice(0, n);
  }

  discard(card: T): void {
    this.discardPile.push(card);
  }

  toArray(): readonly T[] {
    return this.cards;
  }
}

export function createWreckDeck(rng: Rng, withWeather: boolean): Deck<Card> {
  let counter = 0;
  const cards: Card[] = [];
  for (const def of Object.values(CARD_DEFS)) {
    if (def.weatherOnly && !withWeather) continue;
    for (let i = 0; i < def.copies; i++) cards.push({ id: `c${++counter}`, type: def.type as CardType });
  }
  return new Deck(cards, rng).shuffle();
}

export const WEATHER_INFO: Record<WeatherKind, Omit<WeatherCard, 'kind' | 'hurricane'>> = {
  secheresse: { label: 'Soleil de plomb', waterBonus: 0, canCollect: false },
  nuageux: { label: 'Ciel couvert', waterBonus: 0, canCollect: true },
  averse: { label: 'Averse', waterBonus: 1, canCollect: true },
  deluge: { label: 'Pluie diluvienne', waterBonus: 2, canCollect: true },
  ouragan: { label: 'OURAGAN !', waterBonus: 0, canCollect: true },
};

export function weatherCard(kind: WeatherKind): WeatherCard {
  return { kind, hurricane: kind === 'ouragan', ...WEATHER_INFO[kind] };
}

export const HURRICANE_WINDOW: Record<Difficulty, [number, number]> = {
  facile: [14, 17],
  normal: [12, 15],
  difficile: [10, 13],
};

/**
 * Paquet météo : cartes de temps mélangées, puis la carte Ouragan
 * placée aléatoirement entre `minDay` et `maxDay`.
 */
export function createWeatherDeck(rng: Rng, minDay: number, maxDay: number): Deck<WeatherCard> {
  const pool: WeatherKind[] = [
    ...Array<WeatherKind>(3).fill('secheresse'),
    ...Array<WeatherKind>(6).fill('nuageux'),
    ...Array<WeatherKind>(5).fill('averse'),
    ...Array<WeatherKind>(3).fill('deluge'),
  ];
  shuffle(rng, pool);
  const hurricaneDay = randInt(rng, minDay, maxDay);
  const cards: WeatherCard[] = [];
  for (let i = 0; i < hurricaneDay - 1; i++) cards.push(weatherCard(pool[i % pool.length]));
  cards.push(weatherCard('ouragan'));
  return new Deck(cards, rng, false);
}
