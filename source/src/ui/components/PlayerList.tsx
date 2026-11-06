import { CARD_DEFS, MAX_DISEASES, type GameView, type LogEntry } from '../../engine';
import { HealthPips, SickBadge } from './Health';

export const PERSONALITY = { cooperatif: '🤝 Coopératif', egoiste: '💰 Égoïste', paranoiaque: '👀 Paranoïaque' } as const;

interface Props {
  view: GameView;
  activeId: number | null;
  presence?: Record<number, boolean>;
  /** Dernière action récente de chaque joueur (bulle). */
  bubbles: Record<number, LogEntry>;
  onReplaceWithBot?: (seat: number) => void;
  onSelect: (id: number) => void;
}

export default function PlayerList({ view, activeId, presence, bubbles, onReplaceWithBot, onSelect }: Props) {
  const lastVote = view.voteHistory.at(-1);
  return (
    <section>
      <p className="mb-1.5 text-xs text-slate-400">👆 Touchez un naufragé pour voir le récapitulatif de ses actions.</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
        {view.players.map((p) => {
          const active = p.id === activeId;
          const received = lastVote && lastVote.day === view.day ? Object.values(lastVote.ballots).filter((t) => t === p.id).length : 0;
          const offline = presence && presence[p.id] === false && !p.isBot;
          const bubble = bubbles[p.id];
          const shown = p.id === view.viewerId ? [] : p.visibleCards;
          const critical = p.alive && p.diseases >= MAX_DISEASES - 1;
          const sick = p.alive && p.diseases > 0;
          const ring = active ? 'ring-2 ring-amber-300' : critical ? 'ring-2 ring-rose-500' : sick ? 'ring-2 ring-lime-400' : '';
          return (
            <div key={p.id} className={`panel relative flex flex-col p-3 transition ${ring} ${p.alive ? '' : 'opacity-45 grayscale'} ${critical ? 'bg-rose-950/40' : sick ? 'bg-lime-950/30' : ''}`}>
              <button className="flex items-center gap-2 text-left" onClick={() => onSelect(p.id)} aria-label={`Récapitulatif de ${p.name}`}>
                <span className="relative shrink-0">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-slate-900" style={{ background: p.color }}>
                    {p.alive ? p.name[0].toUpperCase() : '💀'}
                  </span>
                  {sick && <span className={`absolute -bottom-1 -right-2 text-xl ${critical ? 'animate-bounce' : ''}`}>🤒</span>}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {p.name} {p.id === view.viewerId && <span className="text-xs text-amber-300">(vous)</span>}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {p.isBot ? `🤖 ${p.personality ? PERSONALITY[p.personality] : 'Bot'}` : offline ? '📴 Déconnecté' : '🧑 Humain'}
                  </span>
                </span>
              </button>
              {p.alive ? (
                <>
                  <div className="mt-2 flex items-center justify-between gap-1">
                    <HealthPips diseases={p.diseases} />
                    <SickBadge diseases={p.diseases} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1 text-xs">
                    <span className="rounded bg-white/10 px-1.5 py-0.5" title="Cartes en main">🃏 {p.handCount}</span>
                    {p.contributed > 0 && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200" title="Ressources partagées">🤝 {p.contributed}</span>}
                    {received > 0 && <span className="rounded bg-rose-500/25 px-1.5 py-0.5 text-rose-200">🗳️ {received}</span>}
                  </div>
                </>
              ) : (
                <span className="mt-2 text-xs text-rose-300">
                  J{p.deathDay} · {p.deathCause}
                </span>
              )}
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
      </div>
    </section>
  );
}
