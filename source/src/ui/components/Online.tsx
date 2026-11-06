import { useCallback, useEffect, useState } from 'react';
import { DIFFICULTY, GameEngine, buildView, type Command, type Difficulty, type GameView, type Personality } from '../../engine';
import { KohLantaEngine, buildKLView, type KLCommand, type KLView } from '../../engine/kohlanta';
import { ClientChallenge, KLBoard, KLChallenge } from '../kl/lazy';
import AvatarPortrait from '../kl/AvatarPortrait';
import { SkinPicker } from '../kl/KLSetup';
import { useKLBotLoop } from '../kl/useKLBotLoop';
import { HostSession } from '../../net/host';
import { ClientSession } from '../../net/client';
import { maxSeats, type LobbyState } from '../../net/protocol';
import type { AppSettings } from '../settings';
import { pickIntroId } from '../intros';
import { useBotLoop, type Speed } from '../useBotLoop';
import GameBoard from './GameBoard';
import IntroScreen from './IntroScreen';
import { PersonalitySelect } from './LocalSetup';

const BOT_NAMES = ['Robin', 'Selma', 'Kenji', 'Ana', 'Tom', 'Lina', 'Oscar', 'Maé', 'Iris', 'Hugo', 'Nina', 'Malik', 'Jade', 'Théo', 'Léa', 'Sami', 'Zoé'];
const PERSONALITY = { cooperatif: '🤝 Coopératif', egoiste: '💰 Égoïste', paranoiaque: '👀 Paranoïaque', random: '🎲 Caractère aléatoire' } as const;

interface CommonProps {
  settings: AppSettings;
  onSettings: (p: Partial<AppSettings>) => void;
  onQuit: () => void;
}

function useSessionVersion(session: { subscribe: (fn: () => void) => () => void } | null): number {
  const [v, setV] = useState(0);
  useEffect(() => (session ? session.subscribe(() => setV((x) => x + 1)) : undefined), [session]);
  return v;
}

function inviteLink(code: string): string {
  const q = new URLSearchParams(location.search);
  q.delete('join');
  q.set('join', code);
  return `${location.origin}${location.pathname}?${q.toString()}`;
}

function presenceOf(lobby: LobbyState | null): Record<number, boolean> {
  return Object.fromEntries((lobby?.seats ?? []).map((s) => [s.seat, s.connected]));
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-4 py-10">{children}</div>;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const input = e.currentTarget.previousElementSibling as HTMLInputElement | null;
      input?.select();
    }
  };
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" />
        <button className="btn-ghost px-3" onClick={copy}>{copied ? '✓ Copié' : '📋 Copier'}</button>
      </span>
    </label>
  );
}

function LobbyPanel({ lobby, mySeat, host, onMySkin }: { lobby: LobbyState; mySeat: number | null; host?: HostSession; onMySkin?: (skin: number) => void }) {
  const kl = lobby.settings.mode === 'kohlanta';
  const MAX = maxSeats(lobby.settings.mode);
  const [botPersonality, setBotPersonality] = useState<Personality | 'random'>('random');
  const addBot = () => {
    const used = new Set(lobby.seats.map((s) => s.name));
    host?.addBot(BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${lobby.seats.length + 1}`, botPersonality);
  };
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Code du salon</div>
          <div className="font-display text-5xl tracking-[0.2em] text-amber-300">{lobby.code}</div>
        </div>
        <div className="text-right text-sm text-slate-300">
          <div className="font-semibold">{kl ? '🔥 Koh Lanta' : '🛶 Survie classique'}</div>
          <div>{DIFFICULTY[lobby.settings.difficulty].label}</div>
          <div>
            {kl
              ? `${lobby.settings.klTeams === 1 ? 'Chacun pour soi' : `${lobby.settings.klTeams} équipes`} · météo ${lobby.settings.klWeather ? 'avec effet' : 'sans effet'}`
              : lobby.settings.weather
                ? '🌦️ Avec météo & ouragan'
                : '🏝️ Sans météo'}
          </div>
        </div>
      </div>
      {host && (
        <div className="mt-4">
          <CopyField label="Lien d'invitation à envoyer à vos amis" value={inviteLink(lobby.code)} />
        </div>
      )}
      <h3 className="mb-2 mt-5 font-semibold">
        {kl ? 'Aventuriers' : 'Naufragés'} ({lobby.seats.length}/{MAX})
      </h3>
      <ul className="flex flex-col gap-2">
        {lobby.seats.map((s) => (
          <li key={s.seat} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2">
            {kl && (s.seat === mySeat && onMySkin ? <SkinPicker value={s.skin} onChange={onMySkin} /> : <AvatarPortrait skin={s.skin} size={30} />)}
            <span className="min-w-0 flex-1 truncate">
              {s.kind === 'bot' ? '🤖' : s.kind === 'host' ? '👑' : '🧑'} <b>{s.name}</b> {s.seat === mySeat && <span className="text-xs text-amber-300">(vous)</span>}
              {s.kind === 'bot' && <span className="ml-2 text-xs text-slate-400">{PERSONALITY[s.personality ?? 'random']}</span>}
              {s.kind === 'remote' && !s.connected && <span className="ml-2 text-xs text-rose-300">déconnecté</span>}
            </span>
            {host && s.kind !== 'host' && (
              <button className="text-sm text-rose-300 hover:text-rose-200" onClick={() => host.removeSeat(s.seat)}>Retirer</button>
            )}
          </li>
        ))}
      </ul>
      {host && lobby.seats.length < MAX && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PersonalitySelect value={botPersonality} onChange={setBotPersonality} />
          <button className="btn-ghost" onClick={addBot}>🤖 Ajouter un bot</button>
        </div>
      )}
      {host && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Mode de jeu</span>
            <select id="lobby-mode" value={lobby.settings.mode} onChange={(e) => host.setSettings({ mode: e.target.value as LobbyState['settings']['mode'] })} className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-2">
              <option value="classique">🛶 Survie classique (3 à 8)</option>
              <option value="kohlanta">🔥 Koh Lanta (4 à 16)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-400">Difficulté</span>
            <select id="lobby-difficulty" value={lobby.settings.difficulty} onChange={(e) => host.setSettings({ difficulty: e.target.value as Difficulty })} className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-2">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                <option key={d} value={d}>{DIFFICULTY[d].label}</option>
              ))}
            </select>
          </label>
          {kl ? (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">Équipes</span>
                <select id="lobby-teams" value={lobby.settings.klTeams} onChange={(e) => host.setSettings({ klTeams: Number(e.target.value) })} className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-2">
                  <option value={1}>Chacun pour soi</option>
                  <option value={2}>2 équipes</option>
                  <option value={3}>3 équipes</option>
                  <option value={4}>4 équipes</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">Météo</span>
                <select id="lobby-klweather" value={lobby.settings.klWeather ? 'oui' : 'non'} onChange={(e) => host.setSettings({ klWeather: e.target.value === 'oui' })} className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-2">
                  <option value="oui">Avec effet (sans ouragan)</option>
                  <option value="non">Sans effet</option>
                </select>
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-slate-400">Météo</span>
              <select id="lobby-weather" value={lobby.settings.weather ? 'oui' : 'non'} onChange={(e) => host.setSettings({ weather: e.target.value === 'oui' })} className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-2">
                <option value="oui">Avec météo & ouragan</option>
                <option value="non">Sans météo (évasion ou mort)</option>
              </select>
            </label>
          )}
        </div>
      )}
    </section>
  );
}

// ───────────────────────────── Hôte ─────────────────────────────

export function OnlineHost({ settings, onSettings, onQuit }: CommonProps) {
  const [session, setSession] = useState<HostSession | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stage, setStage] = useState<'lobby' | 'intro' | 'game'>('lobby');
  const [speed, setSpeed] = useState<Speed>('normal');
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useSessionVersion(session);

  useEffect(() => {
    let cancelled = false;
    let created: HostSession | null = null;
    setFailure(null);
    HostSession.create(settings.playerName || 'Capitaine', settings.skin, { mode: settings.mode, difficulty: settings.difficulty, weather: settings.weather, klTeams: settings.klTeams, klWeather: settings.klWeather })
      .then((s) => {
        if (cancelled) s.close();
        else {
          created = s;
          setSession(s);
        }
      })
      .catch((e: Error) => !cancelled && setFailure(e.message));
    return () => {
      cancelled = true;
      created?.close();
    };
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const onBotError = useCallback((m: string) => {
    setError(m);
    setPaused(true);
  }, []);
  const gEngine = session?.engine instanceof GameEngine ? session.engine : null;
  const kEngine = session?.engine instanceof KohLantaEngine ? session.engine : null;
  useBotLoop(gEngine, version, paused || stage !== 'game', speed, onBotError);
  useKLBotLoop(kEngine, version, paused || stage !== 'game', speed, onBotError);

  const send = useCallback(
    (cmd: Command | KLCommand) => {
      try {
        setError(null);
        session?.dispatch(cmd);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [session],
  );

  const quit = () => {
    session?.close();
    onQuit();
  };

  if (failure) {
    return (
      <Centered>
        <div className="panel p-6 text-center">
          <h2 className="font-display text-2xl text-rose-300">Salon indisponible</h2>
          <p className="mt-2 text-slate-300">{failure}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-ghost" onClick={onQuit}>← Menu</button>
            <button className="btn-primary" onClick={() => setAttempt((a) => a + 1)}>Réessayer</button>
          </div>
        </div>
      </Centered>
    );
  }
  if (!session) {
    return (
      <Centered>
        <div className="panel animate-pulse p-6 text-center text-lg">🌐 Création du salon…</div>
      </Centered>
    );
  }
  const lobby = session.lobby;
  const minPlayers = lobby.settings.mode === 'kohlanta' ? 4 : 3;
  if (stage === 'lobby' || !session.engine) {
    return (
      <Centered>
        <button className="self-start text-sm text-slate-400 hover:text-slate-200" onClick={quit}>← Fermer le salon</button>
        <h2 className="font-display text-3xl text-amber-300">Partie en ligne</h2>
        <p className="text-slate-300">Partagez le code ou le lien. Complétez avec des bots si besoin. Votre navigateur héberge la partie : gardez cet onglet ouvert.</p>
        <LobbyPanel lobby={lobby} mySeat={0} host={session} onMySkin={(skin) => { session.setSkin(0, skin); onSettings({ skin }); }} />
        {error && <p className="text-rose-300">{error}</p>}
        <button
          className="btn-primary py-3 text-lg"
          disabled={lobby.seats.length < minPlayers}
          onClick={() => {
            try {
              session.start(pickIntroId(lobby.settings.mode));
              setStage('intro');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {lobby.seats.length < minPlayers ? `Encore ${minPlayers - lobby.seats.length} joueur(s) minimum` : 'Lancer la partie →'}
        </button>
      </Centered>
    );
  }
  if (stage === 'intro') return <IntroScreen introId={lobby.introId ?? 0} onDone={() => setStage('game')} />;

  const banner = <div className="text-sm text-slate-400">🌐 Salon <b className="tracking-widest text-amber-300">{lobby.code}</b> · vous hébergez la partie, gardez cet onglet ouvert.</div>;
  if (kEngine) {
    const view = buildKLView(kEngine, 0);
    const d = kEngine.decision;
    return (
      <>
        <KLBoard view={view} send={send} error={error ?? session.error} settings={settings} onSettings={onSettings} onQuit={quit} controls={{ speed, setSpeed, paused, setPaused }} presence={presenceOf(lobby)} onReplaceWithBot={(seat) => session.replaceWithBot(seat)} banner={banner} />
        {d.kind === 'challenge' && (
          <KLChallenge
            key={d.challenge.seed}
            view={view}
            challenge={d.challenge}
            autoStart
            localHumans={d.challenge.participants.filter((id) => id === 0 && !kEngine.player(0).isBot)}
            remoteHumans={d.challenge.participants.filter((id) => id !== 0 && !kEngine.player(id).isBot)}
            getRemoteState={(id) => {
              const r = session.remoteChallenge.get(id);
              return r && r.seed === d.challenge.seed ? r.state : undefined;
            }}
            onTick={(snap) => session.broadcastChallenge({ t: 'ch', seed: d.challenge.seed, step: snap.step, elapsed: snap.elapsed, countdown: snap.countdown, states: snap.states, timeScale: snap.timeScale })}
            onComplete={(states) => {
              session.broadcastChallenge({ t: 'ch', seed: d.challenge.seed, step: 'done', elapsed: 0, countdown: 0, states, timeScale: 1 });
              kEngine.submitChallenge(states);
            }}
          />
        )}
      </>
    );
  }

  return (
    <GameBoard
      view={buildView(gEngine!, 0)}
      send={send}
      error={error ?? session.error}
      settings={settings}
      onSettings={onSettings}
      onQuit={quit}
      controls={{ speed, setSpeed, paused, setPaused }}
      presence={presenceOf(lobby)}
      onReplaceWithBot={(seat) => session.replaceWithBot(seat)}
      banner={banner}
    />
  );
}

// ───────────────────────────── Invité ─────────────────────────────

export function OnlineJoin({ settings, onSettings, onQuit, initialCode }: CommonProps & { initialCode?: string }) {
  const [code, setCode] = useState((initialCode ?? '').toUpperCase());
  const [name, setName] = useState(settings.playerName || 'Naufragé');
  const [session, setSession] = useState<ClientSession | null>(null);
  const [introDone, setIntroDone] = useState(false);
  useSessionVersion(session);

  useEffect(() => () => session?.leave(), [session]);

  const quit = () => {
    session?.leave();
    onQuit();
  };

  if (!session) {
    const valid = /^[A-Z]{5}$/.test(code) && name.trim().length > 0;
    return (
      <Centered>
        <button className="self-start text-sm text-slate-400 hover:text-slate-200" onClick={onQuit}>← Retour au menu</button>
        <form
          className="panel flex flex-col gap-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            onSettings({ playerName: name.trim() });
            setSession(new ClientSession(code, name.trim(), settings.skin));
          }}
        >
          <h2 className="font-display text-3xl text-amber-300">Rejoindre une partie</h2>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Votre nom</span>
            <input id="join-name" value={name} maxLength={14} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-400">Code du salon (5 lettres)</span>
            <input
              id="join-code"
              value={code}
              maxLength={5}
              autoCapitalize="characters"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-display text-3xl tracking-[0.3em]"
            />
          </label>
          <button type="submit" className="btn-primary py-3 text-lg" disabled={!valid}>Rejoindre →</button>
        </form>
      </Centered>
    );
  }

  if (session.status === 'closed') {
    return (
      <Centered>
        <div className="panel p-6 text-center">
          <h2 className="font-display text-2xl text-rose-300">Partie interrompue</h2>
          <p className="mt-2 text-slate-300">{session.closedReason}</p>
          <button className="btn-primary mt-4" onClick={onQuit}>← Menu</button>
        </div>
      </Centered>
    );
  }

  const lobby = session.lobby;
  if (!lobby || session.seat === null) {
    return (
      <Centered>
        <div className="panel animate-pulse p-6 text-center text-lg">🔌 Connexion au salon {session.code}…</div>
        <button className="btn-ghost self-center" onClick={quit}>Annuler</button>
      </Centered>
    );
  }
  const reconnecting = session.status === 'reconnecting' && <div className="rounded-xl bg-amber-500/15 px-4 py-2 text-amber-200">📡 Connexion perdue, reconnexion en cours…</div>;

  if (!lobby.started || !session.view) {
    return (
      <Centered>
        <button className="self-start text-sm text-slate-400 hover:text-slate-200" onClick={quit}>← Quitter le salon</button>
        {reconnecting}
        <LobbyPanel lobby={lobby} mySeat={session.seat} onMySkin={(skin) => { session.setSkin(skin); onSettings({ skin }); }} />
        <p className="animate-pulse text-center text-slate-300">⏳ En attente du lancement par l'hôte…</p>
      </Centered>
    );
  }
  if (!introDone) return <IntroScreen introId={lobby.introId ?? 0} onDone={() => setIntroDone(true)} />;

  const banner = (
    <>
      {reconnecting}
      <div className="text-sm text-slate-400">
        🌐 Salon <b className="tracking-widest text-amber-300">{lobby.code}</b> · hébergé par {lobby.seats[0]?.name}
      </div>
    </>
  );
  const view = session.view;
  if ('mode' in view) {
    const klView = view as KLView;
    return (
      <>
        <KLBoard view={klView} send={(cmd) => session.send(cmd)} error={session.error} settings={settings} onSettings={onSettings} onQuit={quit} presence={presenceOf(lobby)} banner={banner} />
        {klView.decision.kind === 'challenge' && klView.challenge && <ClientChallenge key={klView.challenge.seed} session={session} view={klView} />}
      </>
    );
  }
  return <GameBoard view={view as GameView} send={(cmd) => session.send(cmd)} error={session.error} settings={settings} onSettings={onSettings} onQuit={quit} presence={presenceOf(lobby)} banner={banner} />;
}
