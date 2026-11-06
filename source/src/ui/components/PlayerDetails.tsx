import { CARD_DEFS, type GameView, type LogEntry } from '../../engine';
import { HealthPips, SickBadge } from './Health';
import { PERSONALITY } from './PlayerList';

const VOTE_REASON = { water: "privation d'eau", food: 'privation de nourriture', departure: 'place sur le radeau' } as const;

/** Récapitulatif d'un joueur : état, cartes montrées, statistiques et historique de ses actions. */
export default function PlayerDetails({ view, playerId, onClose }: { view: GameView; playerId: number; onClose: () => void }) {
  const p = view.players[playerId];
  const mine = (e: LogEntry) => {
    const fx = e.fx;
    if (!fx || !('playerId' in fx)) return false;
    if (fx.playerId === playerId) return true;
    return ('targetId' in fx && fx.targetId === playerId) || false;
  };
  const entries = view.log.filter((e) => e.text && e.fx?.kind !== 'vote' && mine(e));
  const byDay = new Map<number, LogEntry[]>();
  for (const e of entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);

  const draws = view.log.filter((e) => e.fx?.kind === 'draw' && e.fx.playerId === playerId);
  const black = draws.filter((e) => e.fx?.kind === 'draw' && e.fx.balls.includes('b')).length;
  const gains = draws.reduce((s, e) => s + (e.fx?.kind === 'draw' ? e.fx.gain : 0), 0);
  const votesCast = view.voteHistory.filter((r) => r.ballots[playerId] !== undefined);
  const votesAgainst = view.voteHistory.reduce((s, r) => s + Object.values(r.ballots).filter((t) => t === playerId).length, 0);
  const shown = p.id === view.viewerId ? p.visibleCards : p.visibleCards.filter((c) => c.revealed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={onClose}>
      <div className="panel animate-pop flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Récapitulatif de ${p.name}`}>
        <header className="flex items-center gap-3 border-b border-white/10 p-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-slate-900" style={{ background: p.color }}>
            {p.alive ? p.name[0].toUpperCase() : '💀'}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-2xl">{p.name}</h2>
            <div className="text-sm text-slate-400">
              {p.isBot ? `🤖 Bot ${p.personality ? `· ${PERSONALITY[p.personality]}` : ''}` : '🧑 Humain'}
              {p.id === view.viewerId && ' · vous'}
            </div>
          </div>
          <button className="btn-ghost px-3 py-1" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-3">
            {p.alive ? (
              <>
                <HealthPips diseases={p.diseases} size="text-2xl" />
                <SickBadge diseases={p.diseases} />
                {p.diseases === 0 && <span className="text-sm text-emerald-300">En bonne santé</span>}
              </>
            ) : (
              <span className="text-rose-300">
                💀 Mort au jour {p.deathDay} — {p.deathCause}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {[
              ['🃏 Cartes en main', p.handCount],
              ['🤝 Partagé', p.contributed],
              ['🎱 Tirages', draws.length],
              ['⚫ Boules noires', black],
              ['📦 Ramené', gains],
              ['🗳️ Votes reçus', votesAgainst],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/5 px-3 py-2">
                <dt className="text-xs text-slate-400">{label}</dt>
                <dd className="font-display text-xl tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {shown.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold">{p.id === view.viewerId ? 'Vos cartes' : 'Cartes montrées'}</h3>
              <div className="flex flex-wrap gap-1">
                {shown.map((c) => (
                  <span key={c.id} className="rounded-md border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-sm">
                    {CARD_DEFS[c.type].emoji} {CARD_DEFS[c.type].name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {votesCast.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold">Ses votes</h3>
              <ul className="space-y-0.5 text-sm text-slate-300">
                {votesCast.map((r, i) => (
                  <li key={i}>
                    Jour {r.day} ({VOTE_REASON[r.reason]}) : contre <b>{view.players[r.ballots[playerId]].name}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="mb-1 font-semibold">Historique des actions</h3>
            {byDay.size === 0 ? (
              <p className="text-sm text-slate-400">Rien pour l'instant.</p>
            ) : (
              <ol className="space-y-2">
                {[...byDay.entries()].reverse().map(([day, list]) => (
                  <li key={day}>
                    <div className="text-xs uppercase tracking-wide text-amber-200/80">Jour {day}</div>
                    <ul className="mt-0.5 space-y-0.5 border-l border-white/10 pl-3 text-sm text-slate-200">
                      {list.map((e) => (
                        <li key={e.id}>
                          {e.text}
                          {e.privateText && <span className="ml-1 text-xs italic text-amber-200/90">🔒 {e.privateText}</span>}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
