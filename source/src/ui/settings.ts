import { useEffect, useState } from 'react';
import type { Difficulty } from '../engine';

export type GameMode = 'classique' | 'kohlanta';

export interface AppSettings {
  mode: GameMode;
  difficulty: Difficulty;
  weather: boolean;
  music: boolean;
  sfx: boolean;
  playerName: string;
  klTeams: number;
  klWeather: boolean;
  skin: number;
}

const KEY = 'naufrages.settings';
const DEFAULTS: AppSettings = { mode: 'classique', difficulty: 'normal', weather: true, music: true, sfx: true, playerName: 'Capitaine', klTeams: 2, klWeather: true, skin: 0 };

export function loadSettings(): AppSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function useSettings(): [AppSettings, (patch: Partial<AppSettings>) => void] {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* stockage indisponible : réglages non mémorisés */
    }
  }, [settings]);
  return [settings, (patch) => setSettings((s) => ({ ...s, ...patch }))];
}
