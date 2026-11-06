/** Les aventuriers à incarner : apparence de leur personnage 3D (et de leur portrait). */
export type HairStyle = 'court' | 'long' | 'chignon' | 'rase' | 'boucles' | 'queue' | 'crete';
export type Accessory = 'aucun' | 'barbe' | 'lunettes' | 'chapeau' | 'bandeau' | 'moustache';

export interface Skin {
  id: number;
  name: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  bottom: string;
  accessory: Accessory;
  build: number; // carrure 0.9 – 1.15
}

export const SKINS: Skin[] = [
  { id: 0, name: 'La Baroudeuse', skin: '#f1c7a1', hair: '#7a3e1d', hairStyle: 'queue', top: '#f97316', bottom: '#1e3a5f', accessory: 'aucun', build: 0.95 },
  { id: 1, name: 'Le Colosse', skin: '#8d5a3b', hair: '#1a1a1a', hairStyle: 'rase', top: '#334155', bottom: '#78716c', accessory: 'barbe', build: 1.15 },
  { id: 2, name: 'La Stratège', skin: '#e0ac7e', hair: '#111827', hairStyle: 'chignon', top: '#a855f7', bottom: '#1f2937', accessory: 'lunettes', build: 0.92 },
  { id: 3, name: 'Le Surfeur', skin: '#d9a273', hair: '#facc15', hairStyle: 'long', top: '#06b6d4', bottom: '#f472b6', accessory: 'aucun', build: 1.0 },
  { id: 4, name: 'La Pêcheuse', skin: '#5c3a24', hair: '#0f0f0f', hairStyle: 'boucles', top: '#22c55e', bottom: '#854d0e', accessory: 'bandeau', build: 1.0 },
  { id: 5, name: "L'Aventurier", skin: '#f3d2b3', hair: '#9a3412', hairStyle: 'court', top: '#a3a3a3', bottom: '#57534e', accessory: 'chapeau', build: 1.05 },
  { id: 6, name: 'La Sportive', skin: '#c68863', hair: '#3f1d0b', hairStyle: 'queue', top: '#ef4444', bottom: '#111827', accessory: 'aucun', build: 0.98 },
  { id: 7, name: 'Le Rebelle', skin: '#eac4a0', hair: '#16a34a', hairStyle: 'crete', top: '#18181b', bottom: '#3f3f46', accessory: 'aucun', build: 0.97 },
  { id: 8, name: 'Le Sage', skin: '#a8714a', hair: '#e5e7eb', hairStyle: 'court', top: '#f5f5f4', bottom: '#78350f', accessory: 'moustache', build: 1.02 },
  { id: 9, name: 'La Survivante', skin: '#f6d6c0', hair: '#dc2626', hairStyle: 'long', top: '#65a30d', bottom: '#44403c', accessory: 'bandeau', build: 0.94 },
];

export const skinOf = (id: number): Skin => SKINS[((id % SKINS.length) + SKINS.length) % SKINS.length];
