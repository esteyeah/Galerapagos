import { CARD_DEFS, MAX_DISEASES, type GameView, type LogEntry } from '../../engine';

const PERSONALITY = { cooperatif: '🤝 Coopératif', egoiste: '💰 Égoïste', paranoiaque: '👀 Paranoïaque' } as const;

interface Props {
  view: GameView;
  activeId: number | null;
  presence?: Record<number, boolean>;
  /** Dernière action récente de chaque joueur (bulle). */
  bubbles: Record<number, LogEntry>;
  onReplaceWithBot?: (seat: number) => void;
}

export default function PlayerList({ view, activeId, presence, bubbles, onReplaceWithBot }: Props) {
  const lastVote = view.voteHistory.at(-1);
  return (
    <section className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
      {view.players.map((p) => {
        const active = p.id === activeId;
        const received = lastVote && lastVote.day === view.day ? Object.values(lastVote.ballots).filter((t) => t === p.id).length : 0;
        const offline = presence && presence[p.id] === false && !p.isBot;
        const bubble = bubbles[p.id];
        const shown = p.id === view.viewerId ? [] : p.visibleCards;
        return (
          <div key={p.id} className={`panel relative p-3 transition ${active ? 'ring-2 ring-amber-300' : ''} ${p.alive ? '' : 'opacity-45 grayscale'}`}>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold text-slate-900" style={{ background: p.color }}>
                {p.alive ? p.name[0].toUpperCase() : '💀'}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">
                  {p.name} {p.id === view.viewerId && <span className="text-xs text-amber-300">(vous)</span>}
                </div>
                <div className="truncate text-xs text-slate-400">
                  {p.isBot ? `🤖 ${p.personality ? PERSONALITY[p.personality] : 'Bot'}` : offline ? '📴 Déconnecté' : '🧑 Humain'}
                </div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-xs">
              {p.alive ? (
                <>
                  <span className="rounded bg-white/10 px-1.5 py-0.5" title="Cartes en main">🃏 {p.handCount}</span>
                  {p.diseases > 0 && (
                    <span className={`rounded px-1.5 py-0.5 ${p.diseases >= MAX_DISEASES - 1 ? 'animate-pulse bg-lime-500/30 text-lime-100' : 'bg-lime-500/20 text-lime-200'}`}>
                      🤒 {p.diseases}/{MAX_DISEASES}
                    </span>
                  )}
                  {p.contributed > 0 && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200" title="Ressources partagées">🤝 {p.contributed}</span>}
                  {received > 0 && <span className="rounded bg-rose-500/25 px-1.5 py-0.5 text-rose-200">🗳️ {received}</span>}
                </>
              ) : (
                <span className="text-rose-300">
                  J{p.deathDay} · {p.deathCause}
                </span>
              )}
            </div>
            {shown.length > 0 && p.alive && (
              <div className="mt-1.5 flex flex-wrap gap-1" title="Cartes montrées">
                {shown.map((c) => (
                  <span key={c.id} className="rounded-md border border-amber-300/40 bg-amber-300/10 px-1.5 py-0.5 text-xs">
                    👁️ {CARD_DEFS[c.type].emoji} {CARD_DEFS[c.type].name}
                  </span>
                ))}
              </div>
            )}
            {bubble && p.alive && (
              <div key={bubble.id} className="animate-bubble mt-2 rounded-lg bg-white/10 px-2 py-1 text-xs leading-snug text-slate-100">
                {bubble.text}
              </div>
            )}
            {offline && p.alive && onReplaceWithBot && (
              <button className="mt-2 w-full rounded-lg bg-cyan-500/20 px-2 py-1 text-xs text-cyan-100 hover:bg-cyan-500/30" onClick={() => onReplaceWithBot(p.id)}>
                🤖 Remplacer par un bot
              </button>
            )}
            {active && <div className="absolute -top-2 right-2 rounded-full bg-amber-300 px-2 text-xs font-bold text-slate-900">À son tour</div>}
          </div>
        );
      })}
    </section>
  );
}
