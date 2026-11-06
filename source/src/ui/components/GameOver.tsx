import type { GameView } from '../../engine';

export default function GameOver({ view, onClose, onQuit, quitLabel = 'Nouvelle partie' }: { view: GameView; onClose: () => void; onQuit: () => void; quitLabel?: string }) {
  const r = view.result!;
  const dead = view.players.filter((p) => !p.alive);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4">
      <div className={`panel animate-pop w-full max-w-lg p-8 text-center ${r.victory ? 'border-emerald-400/50' : 'border-rose-400/50'}`}>
        <div className="text-6xl">{r.victory ? '⛵' : '🌀'}</div>
        <h2 className={`mt-2 font-display text-4xl ${r.victory ? 'text-emerald-300' : 'text-rose-400'}`}>{r.victory ? 'Évasion réussie !' : 'Naufrage total'}</h2>
        <p className="mt-2 text-slate-300">{r.reason}</p>
        <p className="text-sm text-slate-400">Partie terminée au jour {view.day}.</p>
        {r.survivors.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold text-emerald-200">Survivants</h3>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {r.survivors.map((id) => {
                const p = view.players[id];
                return (
                  <span key={id} className="rounded-full px-3 py-1 font-semibold text-slate-900" style={{ background: p.color }}>
                    {p.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}
        {dead.length > 0 && (
          <div className="mt-4 text-sm">
            <h3 className="font-semibold text-rose-200">Disparus</h3>
            <ul className="mt-1 text-slate-400">
              {dead.map((p) => (
                <li key={p.id}>
                  💀 {p.name} — jour {p.deathDay}, {p.deathCause?.toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-ghost" onClick={onClose}>Revoir le journal</button>
          <button className="btn-primary" onClick={onQuit}>{quitLabel}</button>
        </div>
      </div>
    </div>
  );
}
