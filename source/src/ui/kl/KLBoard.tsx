import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CHALLENGES, KL_ITEMS, KL_MAX_DISEASES, MAX_FORME, type KLCommand, type KLLogEntry, type KLPlayerView, type KLView } from '../../engine/kohlanta';
import { successChance } from '../../engine';
import type { AppSettings } from '../settings';
import { SPEEDS, type Speed } from '../useBotLoop';
import { HealthPips, SickBadge } from '../components/Health';
import { PERSONALITY } from '../components/PlayerList';
import { audio } from '../audio';
import AvatarPortrait from './AvatarPortrait';
import CampView from './CampView';
import FireGame from './minigames/FireGame';
import { skinOf } from './skins';

export interface KLBotControls {
  speed: Speed;
  setSpeed: (s: Speed) => void;
  paused: boolean;
  setPaused: (p: boolean) => void;
}

interface Props {
  view: KLView;
  send: (c: KLCommand) => void;
  error: string | null;
  settings: AppSettings;
  onSettings: (p: Partial<AppSettings>) => void;
  onQuit: () => void;
  controls?: KLBotControls;
  presence?: Record<number, boolean>;
  onReplaceWithBot?: (seat: number) => void;
  banner?: ReactNode;
  hideHand?: boolean;
}

const VOTE_TITLE = { water: "💧 Qui se passera d'eau ?", food: '🍽️ Qui se passera de nourriture ?', council: '🔥 Conseil : qui doit partir ?', jury: '⚖️ Jury final : qui mérite de gagner ?', ambassador: '🤝 Qui sera votre ambassadeur ?' } as const;

function FormeBar({ forme }: { forme: number }) {
  const pct = forme / MAX_FORME;
  return (
    <div className="flex items-center gap-1.5" title={`Forme ${forme}/${MAX_FORME}`}>
      <span className="text-xs">⚡</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: pct > 0.6 ? '#22c55e' : pct > 0.3 ? '#facc15' : '#ef4444' }} />
      </div>
      <span className="w-6 text-right text-xs tabular-nums text-slate-300">{forme}</span>
    </div>
  );
}

/** Suivi du journal Koh Lanta : sons, mise en avant, élimination, dépouillement. */
function useKLFx(log: KLLogEntry[]) {
  const lastId = useRef<number | null>(null);
  const [spot, setSpot] = useState<KLLogEntry | null>(null);
  const [elim, setElim] = useState<KLLogEntry[]>([]);
  const [reveal, setReveal] = useState<number | null>(null);
  const [flash, setFlash] = useState<KLLogEntry | null>(null);
  useEffect(() => {
    const last = log.at(-1)?.id ?? 0;
    if (lastId.current === null) {
      lastId.current = last;
      return;
    }
    const fresh = log.filter((e) => e.id > lastId.current!);
    lastId.current = last;
    for (const e of fresh) {
      const fx = e.fx;
      if (e.type === 'victory') audio.play('victory');
      if (!fx) continue;
      if (fx.kind === 'draw') audio.play(fx.balls.includes('b') ? 'black' : 'white');
      if (fx.kind === 'fire') audio.play(fx.success ? 'victory' : 'black');
      if (fx.kind === 'disease') audio.play('disease');
      if (fx.kind === 'vote') audio.play('vote');
      if (fx.kind === 'card' || fx.kind === 'jungle') audio.play('card');
      if (fx.kind === 'eliminated') {
        audio.play('death');
        setElim((x) => [...x, e]);
      }
      if (fx.kind === 'reveal') setReveal(e.id);
      if (fx.kind === 'surprise' || fx.kind === 'linked' || fx.kind === 'ambassadors') {
        audio.play('thunder');
        setFlash(e);
      }
      if (['draw', 'fire', 'jungle', 'rest', 'card'].includes(fx.kind)) setSpot(e);
    }
  }, [log]);
  useEffect(() => {
    if (!spot) return;
    const t = setTimeout(() => setSpot(null), 3000);
    return () => clearTimeout(t);
  }, [spot]);
  return { spot, elim: elim[0] ?? null, dismissElim: () => setElim((x) => x.slice(1)), reveal, dismissReveal: () => setReveal(null), flash, dismissFlash: () => setFlash(null) };
}

export default function KLBoard({ view, send, error, settings, onSettings, onQuit, controls, presence, onReplaceWithBot, banner, hideHand }: Props) {
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(true);
  const fx = useKLFx(view.log);
  const d = view.decision;
  const me = view.viewerId !== null ? view.players[view.viewerId] : null;
  const activeId = 'playerId' in d ? d.playerId : null;
  const active = activeId !== null ? view.players[activeId] : null;
  const isCouncil = d.kind === 'vote' && (d.reason === 'council' || d.reason === 'jury');
  const campTeam = isCouncil && d.kind === 'vote' ? d.teamId : me?.alive ? me.team : active?.alive ? active.team : 0;
  const team = view.teams[campTeam] ?? view.teams[0];
  const teamColor = (p: KLPlayerView) => (view.merged ? p.color : view.teams[p.team]?.color ?? p.color);
  const campMembers = useMemo(
    () =>
      view.players
        .filter((p) => p.alive && p.team === campTeam)
        .map((p) => ({ id: p.id, name: p.name, skin: p.skin, teamColor: teamColor(p), diseases: p.diseases, active: p.id === activeId })),
    [view, campTeam, activeId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const cycle = [
    { n: 1, label: 'Confort', icon: '🎁' },
    { n: 2, label: 'Immunité', icon: '📿' },
    { n: 3, label: 'Conseil', icon: '🔥' },
  ];

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-bold text-amber-300">🔥 Koh Lanta</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button className="btn-ghost px-3 py-1" onClick={() => onSettings({ music: !settings.music })}>{settings.music ? '🎵' : '🔇'} Musique</button>
          <button className="btn-ghost px-3 py-1" onClick={() => onSettings({ sfx: !settings.sfx })}>{settings.sfx ? '🔊' : '🔈'} Sons</button>
          {controls && (
            <>
              <span className="text-slate-400">Bots</span>
              {(Object.keys(SPEEDS) as Speed[]).map((s) => (
                <button key={s} onClick={() => controls.setSpeed(s)} className={`rounded-lg px-2 py-1 capitalize ${controls.speed === s ? 'bg-cyan-500 text-slate-900' : 'bg-white/5 hover:bg-white/10'}`}>
                  {s}
                </button>
              ))}
              <button className="btn-ghost px-3 py-1" onClick={() => controls.setPaused(!controls.paused)}>{controls.paused ? '▶️ Reprendre' : '⏸️ Pause'}</button>
            </>
          )}
          {confirmQuit ? (
            <span className="flex items-center gap-1">
              <span className="text-rose-200">Quitter ?</span>
              <button className="btn-danger px-3 py-1" onClick={onQuit}>Oui</button>
              <button className="btn-ghost px-3 py-1" onClick={() => setConfirmQuit(false)}>Non</button>
            </span>
          ) : (
            <button className="btn-ghost px-3 py-1" onClick={() => setConfirmQuit(true)}>🚪 Quitter</button>
          )}
        </div>
      </header>
      {banner}

      {/* Jour et cycle */}
      <section className="flex flex-wrap items-center gap-3">
        <div className="panel px-4 py-2">
          <div className="font-display text-2xl">Jour {view.day}</div>
          <div className="text-xs text-slate-400">
            {view.weather ? `${{ secheresse: '☀️', nuageux: '☁️', averse: '🌦️', deluge: '⛈️', ouragan: '🌀' }[view.weather.kind]} ${view.weather.label}` : 'Météo sans effet'}
          </div>
        </div>
        {view.cyclePosition > 0 ? (
          <div className="flex gap-1.5">
            {cycle.map((c) => (
              <div key={c.n} className={`rounded-xl px-3 py-2 text-sm ${view.cyclePosition === c.n ? 'bg-amber-400 font-bold text-slate-900' : 'bg-white/5 text-slate-400'}`}>
                {c.icon} {c.label}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-rose-500/80 px-3 py-2 text-sm font-bold text-white">🏆 Phase finale</div>
        )}
        <div className="text-sm text-slate-300">{view.merged ? (view.settings.teams === 1 ? '🧍 Chacun pour soi' : '🤝 Tribu réunifiée') : `👥 ${view.teams.length} équipes`}</div>
        {view.jury.length > 0 && <div className="text-sm text-slate-300">⚖️ Jury : {view.jury.length}</div>}
        {view.linkedActive && <div className="rounded-xl bg-amber-500/20 px-3 py-2 text-sm font-semibold text-amber-200">⛓️ Destins liés</div>}
        {view.surpriseCouncil && <div className="animate-pulse rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold text-white">⚡ Conseil surprise</div>}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <CampView
            fire={team?.fire ?? false}
            night={isCouncil}
            council={isCouncil}
            members={campMembers}
            label={isCouncil ? (d.kind === 'vote' && d.reason === 'jury' ? '⚖️ Jury final' : `🔥 Conseil — ${team?.name}`) : `🏕️ Camp — ${team?.name}`}
          />

          {/* Équipes */}
          <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {view.teams.map((t) => (
              <div key={t.id} className="panel p-3" style={{ borderColor: `${t.color}66` }}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold" style={{ color: t.color }}>{t.name}</span>
                  <span className={t.fire ? 'text-orange-400' : 'text-slate-500'}>{t.fire ? '🔥' : '🪵'}</span>
                </div>
                <div className="mt-1 flex gap-3 text-sm tabular-nums">
                  <span title="Eau">💧 {t.water}</span>
                  <span title="Nourriture">🐟 {t.food}</span>
                  <span title="Bois">🪵 {t.wood}</span>
                  <span className="text-slate-400">👥 {view.players.filter((p) => p.alive && p.team === t.id).length}</span>
                </div>
              </div>
            ))}
          </section>

          {/* Aventuriers */}
          <section>
            <p className="mb-1.5 text-xs text-slate-400">👆 Touchez un aventurier pour voir son récapitulatif.</p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-2">
              {[...view.players]
                .sort((a, b) => Number(b.alive) - Number(a.alive) || a.team - b.team)
                .map((p) => {
                  const offline = presence && presence[p.id] === false && !p.isBot;
                  const critical = p.alive && p.diseases >= KL_MAX_DISEASES - 1;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className={`panel relative flex flex-col gap-1.5 p-2.5 text-left transition hover:bg-white/5 ${p.id === activeId ? 'ring-2 ring-amber-300' : critical ? 'ring-2 ring-rose-500' : p.diseases && p.alive ? 'ring-2 ring-lime-400' : ''} ${p.alive ? '' : 'opacity-50'}`}
                    >
                      <span className="flex items-center gap-2">
                        <AvatarPortrait skin={p.skin} team={teamColor(p)} size={40} dead={!p.alive} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">
                            {p.name} {p.id === view.viewerId && <span className="text-xs text-amber-300">(vous)</span>}
                          </span>
                          <span className="block truncate text-xs text-slate-400">
                            {p.isBot ? `🤖 ${p.personality ? PERSONALITY[p.personality] : 'Bot'}` : offline ? '📴 Déconnecté' : skinOf(p.skin).name}
                          </span>
                        </span>
                      </span>
                      {p.alive ? (
                        <>
                          <span className="flex items-center justify-between">
                            <HealthPips diseases={p.diseases} max={KL_MAX_DISEASES} size="text-base" />
                            <span className="flex gap-1">
                              {p.immune && <span className="rounded-full bg-amber-400 px-1.5 text-xs font-bold text-slate-900" title="Immunisé">📿</span>}
                              {view.ambassadors.includes(p.id) && <span className="rounded-full bg-cyan-400 px-1.5 text-xs font-bold text-slate-900" title="Ambassadeur">🤝</span>}
                              {p.challengeWins > 0 && <span className="text-xs text-amber-200" title="Épreuves gagnées">🏆{p.challengeWins}</span>}
                            </span>
                          </span>
                          <FormeBar forme={p.forme} />
                          <SickBadge diseases={p.diseases} max={KL_MAX_DISEASES} />
                          {view.pairs[p.id] !== undefined && <span className="truncate text-xs text-amber-200">⛓️ lié à {view.players[view.pairs[p.id]].name}</span>}
                        </>
                      ) : (
                        <span className="text-xs text-rose-300">
                          J{p.eliminatedDay} · {p.eliminatedHow} {p.isJury && '· ⚖️ juré'}
                        </span>
                      )}
                      {offline && p.alive && onReplaceWithBot && (
                        <span role="button" className="rounded-lg bg-cyan-500/20 px-2 py-1 text-center text-xs text-cyan-100" onClick={(e) => { e.stopPropagation(); onReplaceWithBot(p.id); }}>
                          🤖 Remplacer par un bot
                        </span>
                      )}
                      {p.id === activeId && <span className="absolute -top-2 right-2 rounded-full bg-amber-300 px-2 text-xs font-bold text-slate-900">À son tour</span>}
                    </button>
                  );
                })}
            </div>
          </section>

          <DecisionPanel view={view} send={send} paused={controls?.paused} />
          {error && <div className="animate-pop rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-rose-200">⚠️ {error}</div>}
          {!hideHand && me && <Hand view={view} me={me} send={send} />}
        </div>

        <aside className="panel flex max-h-[70vh] flex-col p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <h2 className="mb-2 font-display text-xl">📖 Journal de l'aventure</h2>
          <LogList log={view.log} />
        </aside>
      </div>

      {fx.spot?.fx && 'playerId' in fx.spot.fx && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div key={fx.spot.id} className="animate-spot flex max-w-xl items-center gap-3 rounded-2xl border border-amber-300/50 bg-slate-900 px-4 py-3 shadow-2xl">
            <AvatarPortrait skin={view.players[fx.spot.fx.playerId].skin} team={teamColor(view.players[fx.spot.fx.playerId])} size={48} />
            <div>
              {fx.spot.fx.kind === 'draw' && (
                <div className="mb-1 flex gap-1.5">
                  {fx.spot.fx.balls.map((b, i) => (
                    <span key={i} className={`animate-ball inline-block h-5 w-5 rounded-full ${b === 'w' ? 'bg-slate-100' : 'border border-white/40 bg-slate-950'}`} style={{ animationDelay: `${i * 160}ms` }} />
                  ))}
                </div>
              )}
              <div className="text-sm">{fx.spot.text}</div>
            </div>
          </div>
        </div>
      )}

      {fx.flash && <EventFlash entry={fx.flash} onDone={fx.dismissFlash} />}
      {fx.elim?.fx?.kind === 'eliminated' && <EliminationOverlay entry={fx.elim} view={view} onDone={fx.dismissElim} />}
      {fx.reveal !== null && !fx.elim && <BallotReveal view={view} onDone={fx.dismissReveal} />}
      {selected !== null && <KLPlayerDetails view={view} id={selected} onClose={() => setSelected(null)} />}
      {view.result && showResult && !fx.elim && <KLGameOver view={view} onClose={() => setShowResult(false)} onQuit={onQuit} />}
    </div>
  );
}

function LogList({ log }: { log: KLLogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = log.at(-1)?.id;
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [last]);
  const style: Record<string, string> = {
    day: 'mt-3 border-t border-white/10 pt-2 font-display text-base text-amber-200',
    danger: 'text-lime-200',
    death: 'font-semibold text-rose-300',
    vote: 'text-fuchsia-200',
    card: 'text-cyan-200',
    info: 'text-slate-300',
    victory: 'font-display text-lg text-emerald-300',
    defeat: 'font-display text-lg text-rose-400',
    action: 'text-slate-200',
  };
  return (
    <div ref={ref} className="flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
      {log.map((e) =>
        e.text || e.privateText ? (
          <div key={e.id} className={style[e.type]}>
            {e.text}
            {e.privateText && <div className="ml-3 text-xs italic text-amber-200/90">🔒 {e.privateText}</div>}
          </div>
        ) : null,
      )}
    </div>
  );
}

function DecisionPanel({ view, send, paused }: { view: KLView; send: (c: KLCommand) => void; paused?: boolean }) {
  const d = view.decision;
  const [draws, setDraws] = useState(2);
  const [fireOpen, setFireOpen] = useState(false);
  if (d.kind === 'gameover' || d.kind === 'challenge') return null;
  const owner = view.players[d.playerId];
  const me = view.viewerId !== null ? view.players[view.viewerId] : null;
  if (!me || me.id !== owner.id) {
    const what = d.kind === 'action' ? 'vit sa journée au camp' : d.kind === 'vote' ? (d.reason === 'jury' ? 'vote en tant que juré' : 'vote') : d.kind === 'ambassador' ? 'négocie en tant qu’ambassadeur' : 'choisit son adversaire';
    return (
      <section className="panel flex items-center gap-3 p-4">
        <AvatarPortrait skin={owner.skin} team={owner.color} size={40} />
        <div>
          <b style={{ color: owner.color }}>{owner.name}</b> {what}
          {!paused && <span className="animate-pulse">…</span>}
        </div>
      </section>
    );
  }
  const team = view.teams[me.team];

  if (d.kind === 'action') {
    const bag = me.bag;
    const k = Math.min(draws, bag.maxDraw);
    const pct = Math.round(successChance(bag, k) * 100);
    const has = (t: string) => me.hand.some((c) => c.type === t);
    const fit = me.forme >= 6 ? 1 : 0;
    const w = view.weather;
    const act = (action: 'fish' | 'water' | 'wood') => send({ type: 'action', playerId: me.id, action, draws: k });
    const opts = [
      { a: 'fish' as const, icon: '🎣', title: 'Pêcher', gain: k + fit + (has('masque') ? 1 : 0), unit: '🐟' },
      { a: 'water' as const, icon: '💧', title: "Chercher de l'eau", gain: k + fit + (has('bache') ? 1 : 0) + (w?.waterBonus ?? 0), unit: '💧', disabled: !!w && !w.canCollect },
      { a: 'wood' as const, icon: '🪓', title: 'Couper du bois', gain: k + fit + (has('machette') ? 1 : 0), unit: '🪵' },
    ];
    return (
      <section className="panel animate-pop p-5">
        <h2 className="font-display text-2xl text-amber-300">À vous, {me.name} !</h2>
        <p className="text-sm text-slate-400">
          Une action au camp. Forme {me.forme}/{MAX_FORME}
          {fit ? ' : en forme, +1 à chaque récolte réussie.' : '.'} {me.forme >= 8 ? 'Pleine forme : une boule blanche en plus.' : me.forme <= 3 ? 'Épuisé·e : des boules noires en plus !' : ''}
        </p>
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">🎱 Boules :</span>
            {Array.from({ length: bag.maxDraw }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setDraws(n)} className={`h-8 w-8 rounded-full font-bold ${k === n ? 'bg-amber-400 text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}>{n}</button>
            ))}
            <span className="ml-1 flex gap-0.5" aria-hidden>
              {Array.from({ length: bag.white }, (_, i) => <span key={`w${i}`} className="inline-block h-3 w-3 rounded-full bg-slate-100" />)}
              {Array.from({ length: bag.black }, (_, i) => <span key={`b${i}`} className="inline-block h-3 w-3 rounded-full border border-white/30 bg-slate-950" />)}
            </span>
            <span>
              Réussite : <b className={pct >= 60 ? 'text-emerald-300' : pct >= 35 ? 'text-amber-300' : 'text-rose-300'}>{pct} %</b>
            </span>
          </div>
          {me.diseases >= KL_MAX_DISEASES - 1 && <p className="mt-2 text-sm font-semibold text-rose-300">⚠️ Encore une maladie et c'est l'évacuation médicale !</p>}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {opts.map((o) => (
            <button key={o.a} disabled={o.disabled} onClick={() => act(o.a)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-amber-300/60 disabled:opacity-35">
              <div className="text-3xl">{o.icon}</div>
              <div className="mt-1 font-semibold">{o.title}</div>
              <div className="text-amber-200">+{o.gain} {o.unit}</div>
              <div className="text-xs text-slate-400">{o.disabled ? 'Soleil de plomb' : `${pct} %`}</div>
            </button>
          ))}
          <button onClick={() => send({ type: 'action', playerId: me.id, action: 'jungle' })} className="rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:-translate-y-0.5 hover:border-amber-300/60">
            <div className="text-3xl">🌴</div>
            <div className="mt-1 font-semibold">Fouiller la jungle</div>
            <div className="text-amber-200">1 objet secret</div>
            <div className="text-xs text-slate-400">Un collier d'immunité ?</div>
          </button>
          <button disabled={team.fire || team.wood < 1} onClick={() => setFireOpen(true)} className="rounded-xl border border-white/10 bg-white/5 p-3 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-orange-400/60 disabled:opacity-35">
            <div className="text-3xl">🔥</div>
            <div className="mt-1 font-semibold">Allumer le feu</div>
            <div className="text-orange-200">Mini-jeu</div>
            <div className="text-xs text-slate-400">{team.fire ? 'Déjà allumé' : team.wood < 1 ? 'Il faut 1 bois' : 'Échec : -1 forme'}</div>
          </button>
          <button onClick={() => send({ type: 'action', playerId: me.id, action: 'rest' })} className="rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:-translate-y-0.5 hover:border-lime-300/60">
            <div className="text-3xl">😴</div>
            <div className="mt-1 font-semibold">Se reposer</div>
            <div className="text-lime-200">+2 forme{me.diseases ? ', −1 maladie' : ''}</div>
            <div className="text-xs text-slate-400">Passer son tour</div>
          </button>
        </div>
        {fireOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
            <div className="panel animate-pop w-full max-w-md p-5">
              <h3 className="mb-3 font-display text-2xl text-orange-300">🔥 Allumer le feu</h3>
              <FireGame
                forme={me.forme}
                onDone={(success) => {
                  setFireOpen(false);
                  send({ type: 'action', playerId: me.id, action: 'fire', success });
                }}
              />
            </div>
          </div>
        )}
      </section>
    );
  }

  if (d.kind === 'vote') {
    return (
      <section className={`panel animate-pop p-5 ${d.reason === 'council' || d.reason === 'jury' ? 'border-orange-500/50 bg-gradient-to-b from-orange-950/40 to-slate-900/60' : ''}`}>
        <h2 className="font-display text-2xl text-orange-300">{VOTE_TITLE[d.reason]}</h2>
        <p className="mt-1 text-sm text-slate-300">
          {d.reason === 'council'
            ? `Écrivez un nom. La personne la plus désignée quitte l'aventure (égalité : tirage au sort).${view.linkedActive ? ' ⛓️ Destins liés : son binôme partira avec elle !' : ''}${view.surpriseCouncil ? ' ⚡ Conseil surprise !' : ''}`
            : d.reason === 'ambassador'
              ? "Votre ambassadeur négociera avec ceux des autres équipes pour éliminer quelqu'un. S'ils ne s'accordent pas, le sort désignera l'un d'eux !"
              : d.reason === 'jury'
              ? "Vous êtes juré·e : votez pour le finaliste qui mérite de remporter l'aventure."
              : `Il manque encore ${d.remaining} portion(s) : la personne désignée tombera malade (et perdra de la forme).`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {d.candidates.map((id) => {
            const p = view.players[id];
            return (
              <button key={id} className="btn-ghost flex items-center gap-2 py-1.5" onClick={() => send({ type: 'vote', playerId: me.id, targetId: id })}>
                <AvatarPortrait skin={p.skin} team={p.color} size={28} /> {p.name} {p.diseases > 0 && <span>🤒{p.diseases}</span>}
                {view.pairs[id] !== undefined && d.reason === 'council' && <span className="text-xs text-amber-200">⛓️ + {view.players[view.pairs[id]].name}</span>}
              </button>
            );
          })}
        </div>
        {d.canNecklace && (
          <button className="btn-primary mt-4" onClick={() => send({ type: 'necklace', playerId: me.id })}>
            📿 Jouer mon collier d'immunité
          </button>
        )}
      </section>
    );
  }

  if (d.kind === 'ambassador') {
    return (
      <section className="panel animate-pop border-cyan-400/50 p-5">
        <h2 className="font-display text-2xl text-cyan-300">🤝 Vous êtes ambassadeur</h2>
        <p className="mt-1 text-sm text-slate-300">
          Proposez le nom d'un aventurier à éliminer. Si tous les ambassadeurs donnent le même nom, il part. Sinon, le sort désignera l'un des ambassadeurs… peut-être vous !
        </p>
        {d.proposals.length > 0 && (
          <ul className="mt-2 text-sm text-cyan-100">
            {d.proposals.map((x) => (
              <li key={x.from}>
                {view.players[x.from].name} propose : <b>{view.players[x.target].name}</b>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {d.candidates.map((id) => {
            const p = view.players[id];
            const agreed = d.proposals.some((x) => x.target === id);
            return (
              <button key={id} className={`${agreed ? 'btn-primary' : 'btn-ghost'} flex items-center gap-2 py-1.5`} onClick={() => send({ type: 'ambassador', playerId: me.id, targetId: id })}>
                <AvatarPortrait skin={p.skin} team={p.color} size={28} /> {p.name} {agreed && '✓'}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="panel animate-pop p-5">
      <h2 className="font-display text-2xl text-amber-300">🪵 Vous avez gagné les poteaux !</h2>
      <p className="mt-1 text-sm text-slate-300">Choisissez l'aventurier que vous affronterez devant le jury final. L'autre deviendra juré.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {d.options.map((id) => {
          const p = view.players[id];
          return (
            <button key={id} className="btn-ghost flex items-center gap-2" onClick={() => send({ type: 'finalChoice', playerId: me.id, targetId: id })}>
              <AvatarPortrait skin={p.skin} team={p.color} size={32} /> Affronter {p.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Hand({ view, me, send }: { view: KLView; me: KLPlayerView; send: (c: KLCommand) => void }) {
  const [giving, setGiving] = useState<string | null>(null);
  const [healing, setHealing] = useState<string | null>(null);
  const playable = new Set(view.playableCardIds);
  const myTurn = view.decision.kind === 'action' && view.decision.playerId === me.id;
  const mates = view.players.filter((p) => p.alive && p.team === me.team && p.id !== me.id);
  const sickMates = view.players.filter((p) => p.alive && p.team === me.team && p.diseases > 0);
  return (
    <section className="panel p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <AvatarPortrait skin={me.skin} team={me.color} size={44} dead={!me.alive} />
        <div>
          <div className="font-display text-xl">{me.name}</div>
          <div className="text-xs text-slate-400">{skinOf(me.skin).name}</div>
        </div>
        {me.alive && (
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <HealthPips diseases={me.diseases} max={KL_MAX_DISEASES} size="text-2xl" />
            <SickBadge diseases={me.diseases} max={KL_MAX_DISEASES} />
            <div className="w-40">
              <FormeBar forme={me.forme} />
            </div>
            {me.immune && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-sm font-bold text-slate-900">📿 Immunisé·e</span>}
          </div>
        )}
        {!me.alive && <span className="text-rose-300">{me.isJury ? '⚖️ Vous êtes juré·e : vous voterez à la finale.' : "Votre aventure s'est arrêtée."}</span>}
      </div>
      <h3 className="mb-2 font-semibold">🎒 Vos objets <span className="text-xs font-normal text-slate-400">(secrets)</span></h3>
      {me.hand.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun objet. Fouillez la jungle ou gagnez une épreuve de confort.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {me.hand.map((c) => {
            const def = KL_ITEMS[c.type];
            const can = playable.has(c.id);
            return (
              <div key={c.id} className={`flex w-44 flex-col rounded-xl border p-2.5 ${can ? 'border-amber-300/70 bg-amber-300/10' : 'border-white/10 bg-white/5'}`}>
                <span className="text-3xl">{def.emoji}</span>
                <span className="font-semibold leading-tight">{def.name}</span>
                <span className="mt-0.5 flex-1 text-xs text-slate-400">{def.description}</span>
                {giving === c.id || healing === c.id ? (
                  <div className="mt-2 flex flex-col gap-1">
                    {(healing ? sickMates : mates).map((p) => (
                      <button
                        key={p.id}
                        className="btn-primary px-2 py-1 text-xs"
                        onClick={() => {
                          if (healing) send({ type: 'playCard', playerId: me.id, cardId: c.id, targetId: p.id });
                          else send({ type: 'give', playerId: me.id, cardId: c.id, targetId: p.id });
                          setGiving(null);
                          setHealing(null);
                        }}
                      >
                        {healing ? 'Soigner' : 'Donner à'} {p.name}
                      </button>
                    ))}
                    <button className="text-xs text-slate-400 underline" onClick={() => { setGiving(null); setHealing(null); }}>Annuler</button>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-1">
                    {can && (
                      <button
                        className="btn-primary flex-1 px-2 py-1 text-sm"
                        onClick={() => (c.type === 'soins' && sickMates.length > 1 ? setHealing(c.id) : send({ type: 'playCard', playerId: me.id, cardId: c.id, targetId: c.type === 'soins' ? sickMates[0]?.id : undefined }))}
                      >
                        Utiliser
                      </button>
                    )}
                    {myTurn && mates.length > 0 && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setGiving(c.id)} title="Donner à un coéquipier">🎁</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function EliminationOverlay({ entry, view, onDone }: { entry: KLLogEntry; view: KLView; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3800);
    return () => clearTimeout(t);
  }, [entry, onDone]);
  if (entry.fx?.kind !== 'eliminated') return null;
  const p = view.players[entry.fx.playerId];
  return (
    <div className="animate-death fixed inset-0 z-[60] flex cursor-pointer items-center justify-center p-4" onClick={onDone}>
      <div className="text-center">
        <div className="relative mx-auto w-fit">
          <AvatarPortrait skin={p.skin} team={p.color} size={120} />
          <span className="animate-skull absolute -right-4 -top-6 text-6xl">💨</span>
        </div>
        <div className="mt-4 font-display text-4xl text-orange-200 sm:text-5xl">{p.name}</div>
        <div className="mt-1 text-xl text-orange-100/90">{entry.fx.how === 'Éliminé au conseil' ? "La tribu a parlé. Votre flamme s'éteint." : entry.fx.how}</div>
        <div className="mt-6 text-xs text-orange-100/50">Touchez pour continuer</div>
      </div>
    </div>
  );
}

/** Dépouillement du conseil : les bulletins sont lus un par un. */
function BallotReveal({ view, onDone }: { view: KLView; onDone: () => void }) {
  const record = [...view.voteHistory].reverse().find((r) => r.reason === 'council');
  const ballots = useMemo(() => (record ? Object.entries(record.ballots).map(([v, t]) => ({ voter: Number(v), target: t })).sort(() => Math.random() - 0.5) : []), [record]);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= ballots.length) return;
    const t = setTimeout(() => {
      setShown((s) => s + 1);
      audio.play('card');
    }, 1100);
    return () => clearTimeout(t);
  }, [shown, ballots.length]);
  if (!record) return null;
  const tally = new Map<number, number>();
  for (const b of ballots.slice(0, shown)) tally.set(b.target, (tally.get(b.target) ?? 0) + 1);
  const done = shown >= ballots.length;
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-gradient-to-b from-slate-950/95 to-orange-950/90 p-4">
      <div className="w-full max-w-lg text-center">
        <div className="text-5xl">🔥🗳️🔥</div>
        <h2 className="mt-2 font-display text-3xl text-orange-200">Dépouillement</h2>
        <div className="mt-6 flex min-h-36 flex-wrap justify-center gap-3">
          {ballots.slice(0, shown).map((b, i) => {
            const p = view.players[b.target];
            const cancelled = record.cancelled?.includes(b.voter);
            return (
              <div key={i} className={`animate-pop w-28 rotate-[-2deg] rounded-lg bg-amber-50 p-2 text-slate-900 shadow-xl ${cancelled ? 'opacity-50' : ''}`} style={{ transform: `rotate(${(i % 3) - 1.5}deg)` }}>
                <div className="font-display text-lg leading-tight" style={{ fontFamily: 'cursive' }}>{p.name}</div>
                {cancelled && <div className="text-xs font-bold text-rose-600">annulé 📿</div>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          {[...tally.entries()].map(([id, n]) => (
            <span key={id} className="rounded-full bg-white/10 px-3 py-1">
              {view.players[id].name} : {n} voix
            </span>
          ))}
        </div>
        {done && (
          <button className="btn-primary mt-6" onClick={onDone}>
            Continuer
          </button>
        )}
      </div>
    </div>
  );
}

function KLPlayerDetails({ view, id, onClose }: { view: KLView; id: number; onClose: () => void }) {
  const p = view.players[id];
  const entries = view.log.filter((e) => e.text && e.fx && 'playerId' in e.fx && e.fx.playerId === id && e.fx.kind !== 'vote');
  const votes = view.voteHistory.filter((r) => r.ballots[id] !== undefined);
  const against = view.voteHistory.reduce((s, r) => s + Object.values(r.ballots).filter((t) => t === id).length, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={onClose}>
      <div className="panel animate-pop flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-white/10 p-5">
          <AvatarPortrait skin={p.skin} team={p.color} size={64} dead={!p.alive} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-2xl">{p.name}</h2>
            <div className="text-sm text-slate-400">
              {skinOf(p.skin).name} · {p.isBot ? `🤖 ${p.personality ? PERSONALITY[p.personality] : ''}` : '🧑 Humain'} · {view.teams[p.team]?.name ?? ''}
            </div>
          </div>
          <button className="btn-ghost px-3 py-1" onClick={onClose}>✕</button>
        </header>
        <div className="space-y-4 overflow-y-auto p-5">
          {p.alive ? (
            <div className="flex flex-wrap items-center gap-3">
              <HealthPips diseases={p.diseases} max={KL_MAX_DISEASES} size="text-2xl" />
              <div className="w-40">
                <FormeBar forme={p.forme} />
              </div>
              {p.immune && <span className="rounded-full bg-amber-400 px-2 text-sm font-bold text-slate-900">📿 Immunisé·e</span>}
            </div>
          ) : (
            <p className="text-rose-300">
              Sorti·e au jour {p.eliminatedDay} : {p.eliminatedHow}
              {p.isJury && ' · membre du jury'}
            </p>
          )}
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {[
              ['🏆 Épreuves gagnées', p.challengeWins],
              ['🎒 Objets', p.handCount],
              ['🗳️ Voix reçues', against],
            ].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-white/5 px-3 py-2">
                <dt className="text-xs text-slate-400">{l}</dt>
                <dd className="font-display text-xl">{v}</dd>
              </div>
            ))}
          </dl>
          {votes.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold">Ses votes</h3>
              <ul className="text-sm text-slate-300">
                {votes.map((r, i) => (
                  <li key={i}>
                    Jour {r.day} ({{ water: 'eau', food: 'nourriture', council: 'conseil', jury: 'jury', ambassador: 'ambassadeur' }[r.reason]}) : {view.players[r.ballots[id]].name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3 className="mb-1 font-semibold">Historique</h3>
            {entries.length === 0 ? (
              <p className="text-sm text-slate-400">Rien pour l'instant.</p>
            ) : (
              <ul className="space-y-0.5 text-sm text-slate-200">
                {[...entries].reverse().map((e) => (
                  <li key={e.id}>
                    <span className="text-xs text-amber-200/70">J{e.day}</span> {e.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KLGameOver({ view, onClose, onQuit }: { view: KLView; onClose: () => void; onQuit: () => void }) {
  const r = view.result!;
  const w = r.winnerId !== null ? view.players[r.winnerId] : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
      <div className="panel animate-pop w-full max-w-lg p-8 text-center">
        {w ? (
          <>
            <div className="text-5xl">🏆</div>
            <div className="mx-auto mt-3 w-fit">
              <AvatarPortrait skin={w.skin} team={w.color} size={110} />
            </div>
            <h2 className="mt-3 font-display text-4xl text-amber-300">{w.name}</h2>
            <p className="text-lg">remporte l'aventure !</p>
          </>
        ) : (
          <h2 className="font-display text-4xl text-rose-400">Aventure terminée</h2>
        )}
        <p className="mt-2 text-slate-300">{r.reason}</p>
        {Object.keys(r.juryVotes).length > 0 && (
          <div className="mt-4 flex justify-center gap-3">
            {r.finalists.map((id) => (
              <div key={id} className="rounded-xl bg-white/5 px-4 py-2">
                <div className="font-semibold">{view.players[id].name}</div>
                <div className="font-display text-2xl text-amber-200">{r.juryVotes[id] ?? 0} voix</div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-ghost" onClick={onClose}>Revoir le journal</button>
          <button className="btn-primary" onClick={onQuit}>Nouvelle partie</button>
        </div>
      </div>
    </div>
  );
}

export { CHALLENGES };

/** Annonce plein écran : conseil surprise, destins liés, ambassadeurs. */
function EventFlash({ entry, onDone }: { entry: KLLogEntry; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [entry, onDone]);
  const kind = entry.fx?.kind;
  const title = kind === 'surprise' ? '⚡ Conseil surprise !' : kind === 'linked' ? '⛓️ Destins liés !' : '🤝 Les ambassadeurs';
  const bg = kind === 'surprise' ? 'from-rose-700/95 to-slate-950/95' : kind === 'linked' ? 'from-amber-700/95 to-slate-950/95' : 'from-cyan-700/95 to-slate-950/95';
  return (
    <div className={`animate-pop fixed inset-0 z-[58] flex cursor-pointer items-center justify-center bg-gradient-to-b ${bg} p-6`} onClick={onDone}>
      <div className="max-w-xl text-center">
        <h2 className="font-display text-5xl text-white drop-shadow sm:text-6xl">{title}</h2>
        <p className="mt-4 text-lg text-white/90">{entry.text.replace(/^[^ ]+ /, '')}</p>
        <p className="mt-6 text-xs text-white/50">Touchez pour continuer</p>
      </div>
    </div>
  );
}
