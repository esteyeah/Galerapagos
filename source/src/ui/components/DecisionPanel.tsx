import { useState } from 'react';
import { CARD_DEFS, MAX_DISEASES, successChance, type ActionKind, type Command, type GameView, type PlayerView, type ViewDecision } from '../../engine';

const PHASE_LABEL: Record<string, string> = {
  action: "agit sur l'île",
  trade: 'étudie une proposition d’échange',
  contribute: 'hésite à partager ses réserves',
  vote: 'vote',
  shield: 'décide de se protéger ou non',
  flee: 'vote pour le départ',
};

interface Props {
  view: GameView;
  send: (c: Command) => void;
  paused?: boolean;
}

export default function DecisionPanel({ view, send, paused }: Props) {
  const d = view.decision;
  if (d.kind === 'gameover') {
    return <section className="panel p-5 text-center font-display text-2xl">{view.result?.victory ? '🏆 Victoire des survivants !' : '☠️ Défaite…'}</section>;
  }
  const owner = view.players[d.playerId];
  const me = view.viewerId !== null ? view.players[view.viewerId] : null;
  if (!me || me.id !== owner.id) {
    return (
      <section className="panel flex items-center gap-3 p-5">
        <span className="text-3xl">{owner.isBot ? '🤖' : '⏳'}</span>
        <div>
          <span className="font-semibold" style={{ color: owner.color }}>{owner.name}</span> {PHASE_LABEL[d.kind]}
          {!paused && <span className="animate-pulse">…</span>}
          {paused && <span className="ml-2 text-amber-300">(en pause)</span>}
          {d.kind === 'trade' && d.fromId === view.viewerId && <div className="text-sm text-slate-400">Vous attendez sa réponse à votre proposition d'échange.</div>}
        </div>
      </section>
    );
  }

  const id = me.id;
  return (
    <section className="panel animate-pop p-5" key={`${d.kind}-${view.log.at(-1)?.id}`}>
      {d.kind === 'action' && <ActionChoice view={view} me={me} d={d} send={send} />}
      {d.kind === 'trade' && <TradeAnswer view={view} me={me} d={d} send={send} />}

      {d.kind === 'contribute' && (
        <div>
          <h2 className="font-display text-2xl text-rose-300">{d.reason === 'consumption' ? '⚠️ Pénurie pour la nuit' : "⚠️ Le radeau n'est pas prêt"}</h2>
          <p className="mt-1 text-slate-300">
            Il manque{' '}
            {[d.shortWater && `${d.shortWater} 💧`, d.shortFood && `${d.shortFood} 🐟`, d.shortPlaces && `${d.shortPlaces} place(s) 🛶`].filter(Boolean).join(', ')}.{' '}
            {d.reason === 'consumption'
              ? "Sinon, la tribu votera pour désigner qui s'en passera (et tombera malade)."
              : "Sinon, ceux qui n'ont pas de place resteront sur l'île face à l'ouragan."}{' '}
            Partagez des cartes depuis votre main, ou gardez-les.
          </p>
          <button className="btn-ghost mt-4" onClick={() => send({ type: 'pass', playerId: id })}>🤐 Garder mes cartes</button>
        </div>
      )}

      {d.kind === 'vote' && <VoteChoice view={view} me={me} d={d} send={send} />}

      {d.kind === 'shield' && (
        <div>
          <h2 className="font-display text-2xl text-rose-300">{d.source === 'shot' ? '💥 On vous tire dessus !' : '🗳️ La tribu vous a désigné·e !'}</h2>
          <p className="mt-1 text-slate-300">Utiliser votre 🛡️ plaque de tôle pour y échapper ?</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => send({ type: 'shield', playerId: id, use: true })}>🛡️ Me protéger</button>
            <button className="btn-ghost" onClick={() => send({ type: 'shield', playerId: id, use: false })}>Accepter mon sort</button>
          </div>
        </div>
      )}

      {d.kind === 'flee' && (
        <div>
          <h2 className="font-display text-2xl text-emerald-300">⛵ Le radeau est prêt !</h2>
          <p className="mt-1 text-slate-300">Il y a assez de places et de vivres pour tous les survivants. Partir maintenant ?</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => send({ type: 'flee', playerId: id, yes: true })}>⛵ Prendre la mer</button>
            <button className="btn-ghost" onClick={() => send({ type: 'flee', playerId: id, yes: false })}>Rester un jour de plus</button>
          </div>
        </div>
      )}
    </section>
  );
}

function ActionChoice({ view, me, d, send }: { view: GameView; me: PlayerView; d: Extract<ViewDecision, { kind: 'action' }>; send: (c: Command) => void }) {
  const [draws, setDraws] = useState(2);
  const has = (t: string) => me.visibleCards.some((c) => c.type === t);
  const w = view.weather;
  const k = Math.min(draws, view.bag.maxDraw);
  const pct = Math.round(successChance(view.bag, k) * 100);
  const act = (action: ActionKind) => send({ type: 'action', playerId: me.id, action, draws: k });
  const options: { a: ActionKind; icon: string; title: string; gain: string; hint?: string; disabled?: boolean }[] = [
    { a: 'fish', icon: '🎣', title: 'Pêcher', gain: `+${k + (has('canne') ? 1 : 0)} 🐟`, hint: has('canne') ? 'Canne à pêche : +1' : undefined },
    {
      a: 'water',
      icon: '💧',
      title: "Recueillir l'eau",
      gain: `+${k + (has('bache') ? 1 : 0) + (w?.waterBonus ?? 0)} 💧`,
      hint: w && !w.canCollect ? 'Soleil de plomb : impossible' : w?.waterBonus ? `Pluie : +${w.waterBonus}` : has('bache') ? 'Bâche : +1' : undefined,
      disabled: !!w && !w.canCollect,
    },
    { a: 'wood', icon: '🪓', title: 'Couper du bois', gain: `+${k + (has('hache') ? 1 : 0)} 🪵`, hint: has('hache') ? 'Hache : +1' : undefined },
  ];
  return (
    <div>
      <h2 className="font-display text-2xl text-amber-300">
        À vous, {me.name} ! {d.extraActions > 0 && <span className="text-base text-amber-200">☕ action bonus</span>}
      </h2>
      <p className="text-sm text-slate-400">Une action par jour. Avant d'agir, vous pouvez jouer, donner, échanger ou montrer des cartes depuis votre main.</p>

      <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">🎱 Boules à piocher :</span>
          {Array.from({ length: view.bag.maxDraw }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setDraws(n)} className={`h-8 w-8 rounded-full font-bold ${k === n ? 'bg-amber-400 text-slate-900' : 'bg-white/10 hover:bg-white/20'}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span className="flex gap-1" aria-hidden>
            {Array.from({ length: view.bag.white }, (_, i) => <span key={`w${i}`} className="inline-block h-3.5 w-3.5 rounded-full bg-slate-100" />)}
            {Array.from({ length: view.bag.black }, (_, i) => <span key={`b${i}`} className="inline-block h-3.5 w-3.5 rounded-full border border-white/30 bg-slate-950" />)}
          </span>
          <span>
            Chance de ne tirer que des blanches : <b className={pct >= 60 ? 'text-emerald-300' : pct >= 35 ? 'text-amber-300' : 'text-rose-300'}>{pct} %</b>
          </span>
        </div>
        {me.diseases >= MAX_DISEASES - 1 && <p className="mt-2 text-sm font-semibold text-lime-300">⚠️ Vous êtes malade : une boule noire vous tuerait. Reposez-vous ou soignez-vous !</p>}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {options.map((o) => (
          <button
            key={o.a}
            disabled={o.disabled}
            onClick={() => act(o.a)}
            className="group rounded-xl border border-white/10 bg-white/5 p-3 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:border-amber-300/60 enabled:hover:bg-amber-300/10 disabled:opacity-35"
          >
            <div className="text-3xl transition group-enabled:group-hover:scale-110">{o.icon}</div>
            <div className="mt-1 font-semibold">{o.title}</div>
            <div className="text-amber-200">{o.gain}</div>
            <div className="text-xs text-slate-400">{o.hint ?? `${pct} % de réussite`}</div>
          </button>
        ))}
        <button onClick={() => send({ type: 'action', playerId: me.id, action: 'wreck' })} className="group rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:-translate-y-0.5 hover:border-amber-300/60 hover:bg-amber-300/10">
          <div className="text-3xl transition group-hover:scale-110">🛳️</div>
          <div className="mt-1 font-semibold">Fouiller l'épave</div>
          <div className="text-amber-200">1 🃏 secrète</div>
          <div className="text-xs text-slate-400">Sans risque · {view.wreckRemaining} objets</div>
        </button>
        <button onClick={() => send({ type: 'rest', playerId: me.id })} className="group rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:-translate-y-0.5 hover:border-lime-300/60 hover:bg-lime-300/10">
          <div className="text-3xl transition group-hover:scale-110">😴</div>
          <div className="mt-1 font-semibold">Se reposer</div>
          <div className="text-lime-200">{me.diseases > 0 ? '−1 maladie' : 'Rien'}</div>
          <div className="text-xs text-slate-400">Passer son tour</div>
        </button>
      </div>
    </div>
  );
}

function TradeAnswer({ view, me, d, send }: { view: GameView; me: PlayerView; d: Extract<ViewDecision, { kind: 'trade' }>; send: (c: Command) => void }) {
  const from = view.players[d.fromId];
  const offered = d.offered ? CARD_DEFS[d.offered.type] : null;
  return (
    <div>
      <h2 className="font-display text-2xl text-cyan-300">🤝 Proposition d'échange</h2>
      <p className="mt-1 text-slate-300">
        <b style={{ color: from.color }}>{from.name}</b> vous propose{' '}
        {offered ? (
          <b>
            {offered.emoji} {offered.name}
          </b>
        ) : (
          'une carte'
        )}
        . Choisissez la carte que vous donnez en échange, ou refusez.
      </p>
      {offered && <p className="text-sm text-slate-400">{offered.description}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {me.visibleCards.map((c) => (
          <button key={c.id} className="btn-ghost" onClick={() => send({ type: 'answerTrade', playerId: me.id, accept: true, cardId: c.id })}>
            Donner {CARD_DEFS[c.type].emoji} {CARD_DEFS[c.type].name}
          </button>
        ))}
        <button className="btn-danger" onClick={() => send({ type: 'answerTrade', playerId: me.id, accept: false })}>✋ Refuser</button>
      </div>
    </div>
  );
}

function VoteChoice({ view, me, d, send }: { view: GameView; me: PlayerView; d: Extract<ViewDecision, { kind: 'vote' }>; send: (c: Command) => void }) {
  const [shootMode, setShootMode] = useState(false);
  const targets = shootMode ? view.players.filter((p) => p.alive && p.id !== me.id).map((p) => p.id) : d.candidates;
  const title = d.reason === 'departure' ? "🗳️ Qui reste sur l'île ?" : d.reason === 'water' ? "🗳️ Qui sera privé d'eau ?" : '🗳️ Qui sera privé de nourriture ?';
  return (
    <div>
      <h2 className="font-display text-2xl text-rose-300">{title}</h2>
      <p className="mt-1 text-slate-300">
        {d.reason === 'departure'
          ? `Il manque encore ${d.remaining} place(s) : la personne désignée restera sur l'île face à l'ouragan.`
          : `Il manque encore ${d.remaining} portion(s). La personne désignée s'en passera cette nuit et tombera malade (à ${MAX_DISEASES} maladies, on meurt).`}{' '}
        En cas d'égalité, tirage au sort.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {targets.map((tid) => {
          const t = view.players[tid];
          return (
            <button
              key={tid}
              className={shootMode ? 'btn-danger' : 'btn-ghost'}
              style={shootMode ? undefined : { borderColor: t.color }}
              onClick={() => send(shootMode ? { type: 'shoot', playerId: me.id, targetId: tid } : { type: 'vote', playerId: me.id, targetId: tid })}
            >
              {shootMode ? '🔫' : '👉'} {t.name} {t.diseases > 0 && <span title="Malade">🤒{t.diseases}</span>}
            </button>
          );
        })}
      </div>
      {d.canShoot && (
        <button className="mt-3 text-sm text-rose-300 underline decoration-dotted" onClick={() => setShootMode((s) => !s)}>
          {shootMode ? '↩ Revenir au vote' : "🔫 Sortir le fusil (tirer directement sur quelqu'un)"}
        </button>
      )}
    </div>
  );
}
