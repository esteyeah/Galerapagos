import { useEffect, useState } from 'react';
import { INTROS, KL_INTROS } from '../intros';

export default function IntroScreen({ introId, onDone, waitingLabel }: { introId: number; onDone: () => void; waitingLabel?: string }) {
  const story = [...INTROS, ...KL_INTROS].find((s) => s.id === introId) ?? INTROS[0];
  const [shown, setShown] = useState(1);
  useEffect(() => {
    if (shown >= story.paragraphs.length) return;
    const t = setTimeout(() => setShown((s) => s + 1), 2600);
    return () => clearTimeout(t);
  }, [shown, story.paragraphs.length]);
  const finished = shown >= story.paragraphs.length;

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center gap-6 py-10">
      <div className="text-center">
        <div className="text-6xl">{story.icon}</div>
        <p className="mt-3 text-xs uppercase tracking-[0.3em] text-amber-200/70">Il était une fois…</p>
        <h1 className="mt-1 font-display text-4xl text-amber-300 sm:text-5xl" style={{ textWrap: 'balance' }}>{story.title}</h1>
      </div>
      <div className="panel space-y-4 p-6 text-lg leading-relaxed text-slate-200">
        {story.paragraphs.slice(0, shown).map((p, i) => (
          <p key={i} className="animate-typein">{p}</p>
        ))}
      </div>
      <div className="flex justify-center gap-2">
        {!finished && <button className="btn-ghost" onClick={() => setShown(story.paragraphs.length)}>Tout afficher</button>}
        <button className="btn-primary text-lg" onClick={onDone}>{finished ? (waitingLabel ?? "Survivre →") : 'Passer l’intro →'}</button>
      </div>
    </div>
  );
}
