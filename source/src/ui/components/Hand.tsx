import { useState } from 'react';
import { CARD_DEFS, MAX_DISEASES, type Card, type Command, type GameView } from '../../engine';
import { HealthPips, SickBadge } from './Health';

type Mode = { cardId: string; kind: 'give' | 'trade' | 'soins' } | null;

export default function Hand({ view, send }: { view: GameView; send: (c: Command) => void }) {
  const [mode, setMode] = useState<Mode>(null);
  const me = view.viewerId !== null ? view.players[view.viewerId] : null;
  if (!me) return null;
  const playable = new Set(view.playableCardIds);
  const d = view.decision;
  const myTurn = d.kind === 'action' && d.playerId === me.id;
  const others = view.players.filter((p) => p.alive && p.id !== me.id);
  const sick = view.players.filter((p) => p.alive && p.diseases > 0);

  const play = (c: Card) => {
    if (c.type === 'soins') {
      if (sick.length === 1) send({ type: 'playCard', playerId: me.id, cardId: c.id, targetId: sick[0].id });
      else setMode({ cardId: c.id, kind: 'soins' });
      return;
    }
    send({ type: 'playCard', playerId: me.id, cardId: c.id });
  };

  const pick = (targetId: number) => {
    if (!mode) return;
    if (mode.kind === 'give') send({ type: 'give', playerId: me.id, cardId: mode.cardId, targetId });
    if (mode.kind === 'trade') send({ type: 'proposeTrade', playerId: me.id, cardId: mode.cardId, targetId });
    if (mode.kind === 'soins') send({ type: 'playCard', playerId: me.id, cardId: mode.cardId, targetId });
    setMode(null);
  };

  return (
    <section className="panel p-4">
      <h2 className="mb-1 font-display text-xl">
        🎒 Main de {me.name} <span className="text-sm font-normal text-slate-400">— cachée aux autres, sauf les cartes 👁️ montrées</span>
      </h2>
      {me.alive && (
        <div className={`mb-3 flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 ${me.diseases >= MAX_DISEASES - 1 ? 'bg-rose-500/20' : me.diseases ? 'bg-lime-500/15' : 'bg-white/5'}`}>
          <span className="text-sm font-semibold">Votre santé</span>
          <HealthPips diseases={me.diseases} size="text-2xl" />
          <SickBadge diseases={me.diseases} />
          {me.diseases > 0 && <span className="text-xs text-slate-300">Se reposer ou une 💊 trousse de secours guérit une maladie.</span>}
        </div>
      )}
      {myTurn && <p className="mb-2 text-xs text-slate-400">Pendant votre tour : donner une carte est gratuit ; vous pouvez proposer jusqu'à {d.tradesLeft} échange(s).</p>}
      {me.visibleCards.length === 0 ? (
        <p className="text-sm text-slate-400">{me.alive ? "Vos poches sont vides. Fouillez l'épave pour trouver des objets." : 'Vous avez péri.'}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {me.visibleCards.map((c) => {
            const def = CARD_DEFS[c.type];
            const can = playable.has(c.id);
            const selecting = mode?.cardId === c.id;
            return (
              <div key={c.id} className={`flex w-44 flex-col rounded-xl border p-2.5 ${can ? 'border-amber-300/70 bg-amber-300/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{def.emoji}</span>
                  {c.revealed && <span className="rounded bg-amber-300/20 px-1.5 text-[11px] text-amber-200" title="Visible par tous">👁️ montrée</span>}
                </div>
                <div className="font-semibold leading-tight">{def.name}</div>
                <div className="mt-0.5 flex-1 text-xs text-slate-400">{def.description}</div>
                {selecting ? (
                  <div className="mt-2 flex flex-col gap-1">
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">{mode.kind === 'give' ? 'Donner à' : mode.kind === 'trade' ? 'Échanger avec' : 'Soigner'}</span>
                    {(mode.kind === 'soins' ? sick : others).map((p) => (
                      <button key={p.id} className="btn-primary px-2 py-1 text-xs" onClick={() => pick(p.id)}>
                        {p.name}
                      </button>
                    ))}
                    <button className="text-xs text-slate-400 underline" onClick={() => setMode(null)}>Annuler</button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {can && (
                      <button className="btn-primary flex-1 px-2 py-1 text-sm" onClick={() => play(c)}>
                        Jouer
                      </button>
                    )}
                    {myTurn && others.length > 0 && (
                      <>
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setMode({ cardId: c.id, kind: 'give' })} title="Donner cette carte">🎁</button>
                        {d.tradesLeft > 0 && (
                          <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setMode({ cardId: c.id, kind: 'trade' })} title="Proposer un échange">🔄</button>
                        )}
                      </>
                    )}
                    {!c.revealed && me.alive && (
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => send({ type: 'reveal', playerId: me.id, cardId: c.id })} title="Montrer cette carte à tout le monde (définitif)">
                        👁️
                      </button>
                    )}
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
