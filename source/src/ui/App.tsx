import { useEffect, useState } from 'react';
import type { PlayerConfig } from '../engine';
import { audio } from './audio';
import { pickIntroId } from './intros';
import { useSettings } from './settings';
import MainMenu from './components/MainMenu';
import LocalSetup from './components/LocalSetup';
import LocalGame from './components/LocalGame';
import IntroScreen from './components/IntroScreen';
import { OnlineHost, OnlineJoin } from './components/Online';

type Screen =
  | { name: 'menu' }
  | { name: 'local-setup' }
  | { name: 'local-intro'; configs: PlayerConfig[]; introId: number }
  | { name: 'local-game'; configs: PlayerConfig[]; id: number }
  | { name: 'host' }
  | { name: 'join'; code?: string };

function initialScreen(): Screen {
  const code = new URLSearchParams(location.search).get('join');
  return code ? { name: 'join', code } : { name: 'menu' };
}

export default function App() {
  const [settings, setSettings] = useSettings();
  const [screen, setScreen] = useState<Screen>(initialScreen);

  // Le son ne peut démarrer qu'après une interaction de l'utilisateur.
  useEffect(() => {
    audio.sfxOn = settings.sfx;
    const apply = () => audio.setMusic(settings.music);
    if (audio.musicOn !== settings.music) {
      const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
      if (!settings.music || activated) apply();
      else {
        window.addEventListener('pointerdown', apply, { once: true });
        return () => window.removeEventListener('pointerdown', apply);
      }
    }
  }, [settings.music, settings.sfx]);

  const menu = () => {
    const q = new URLSearchParams(location.search);
    if (q.has('join')) {
      q.delete('join');
      history.replaceState(null, '', `${location.pathname}${q.toString() ? `?${q}` : ''}`);
    }
    setScreen({ name: 'menu' });
  };
  const common = { settings, onSettings: setSettings, onQuit: menu };

  switch (screen.name) {
    case 'menu':
      return <MainMenu settings={settings} onSettings={setSettings} onLocal={() => setScreen({ name: 'local-setup' })} onHost={() => setScreen({ name: 'host' })} onJoin={() => setScreen({ name: 'join' })} />;
    case 'local-setup':
      return <LocalSetup playerName={settings.playerName} onBack={menu} onStart={(configs) => setScreen({ name: 'local-intro', configs, introId: pickIntroId() })} />;
    case 'local-intro':
      return <IntroScreen introId={screen.introId} onDone={() => setScreen({ name: 'local-game', configs: screen.configs, id: Date.now() })} />;
    case 'local-game':
      return <LocalGame key={screen.id} configs={screen.configs} {...common} />;
    case 'host':
      return <OnlineHost {...common} />;
    case 'join':
      return <OnlineJoin {...common} initialCode={screen.code} />;
  }
}
