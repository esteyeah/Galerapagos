import { useEffect, useRef } from 'react';
import type { LogEntry, LogType } from '../../engine';

const STYLE: Record<LogType, string> = {
  day: 'mt-3 border-t border-white/10 pt-2 font-display text-base text-amber-200',
  action: 'text-slate-200',
  danger: 'text-lime-200',
  death: 'font-semibold text-rose-300',
  vote: 'text-fuchsia-200',
  card: 'text-cyan-200',
  info: 'text-slate-400',
  victory: 'font-display text-lg text-emerald-300',
  defeat: 'font-display text-lg text-rose-400',
};

export default function EventLog({ log }: { log: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = log.at(-1)?.id;
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [last]);

  return (
    <aside className="panel flex max-h-[70vh] flex-col p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
      <h2 className="mb-2 font-display text-xl">📖 Journal de bord</h2>
      <div ref={ref} className="flex-1 space-y-1 overflow-y-auto pr-1 text-sm">
        {log.map((e) =>
          e.text || e.privateText ? (
            <div key={e.id} className={STYLE[e.type]}>
              {e.text}
              {e.privateText && <div className="ml-3 text-xs italic text-amber-200/90">🔒 {e.privateText}</div>}
            </div>
          ) : null,
        )}
      </div>
    </aside>
  );
}
