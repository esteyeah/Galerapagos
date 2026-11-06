import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHALLENGES, IDLE_STATE, botPlan, type ChallengeInfo, type ChallengeState, type KLPlayerView } from '../../engine/kohlanta';
import { createRng } from '../../engine';

export type StageStep = 'ready' | 'countdown' | 'playing' | 'done';

export interface RunnerSnapshot {
  step: StageStep;
  /** Humain qui joue sur cet appareil pendant cette manche (null = spectateur). */
  currentHuman: number | null;
  elapsed: number;
  countdown: number;
  states: Record<number, ChallengeState>;
  timeScale: number;
}

interface Options {
  challenge: ChallengeInfo;
  players: KLPlayerView[];
  /** Humains qui jouent sur cet appareil (plusieurs = chacun son tour). */
  localHumans: number[];
  /** Humains qui jouent ailleurs, en même temps (partie en ligne, côté hôte). */
  remoteHumans: number[];
  getRemoteState?: (id: number) => ChallengeState | undefined;
  onComplete: (states: Record<number, ChallengeState>) => void;
  onTick?: (snap: RunnerSnapshot) => void;
  /** Démarre le compte à rebours sans attendre « Je suis prêt » (partie en ligne). */
  autoStart?: boolean;
}

const COUNTDOWN = 3;

/** Fait tourner une épreuve : temps, bots simulés, manches successives en pass-and-play. */
export function useChallengeRunner({ challenge, players, localHumans, remoteHumans, getRemoteState, onComplete, onTick, autoStart }: Options) {
  const def = CHALLENGES[challenge.game];
  const plans = useMemo(() => {
    const rng = createRng(challenge.seed + 7);
    const map = new Map<number, (t: number) => ChallengeState>();
    for (const id of challenge.participants) {
      const p = players[id];
      if (p.isBot || (!localHumans.includes(id) && !remoteHumans.includes(id))) map.set(id, botPlan(def, p.forme, rng));
    }
    return map;
  }, [challenge.seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const sequential = localHumans.length > 1;
  const runs = sequential ? localHumans : [localHumans[0] ?? null];
  const [runIdx, setRunIdx] = useState(0);
  const recordings = useRef(new Map<number, { t: number; s: ChallengeState }[]>());
  const finals = useRef(new Map<number, ChallengeState>());
  const live = useRef(new Map<number, ChallengeState>());
  const finishedAt = useRef<number | null>(null);
  const [snap, setSnap] = useState<RunnerSnapshot>({ step: runs[0] === null || autoStart ? 'countdown' : 'ready', currentHuman: runs[0], elapsed: 0, countdown: COUNTDOWN, states: {}, timeScale: 1 });
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const statesRef = useRef<Record<number, ChallengeState>>({});
  const completed = useRef(false);
  const timeScale = useRef(1);

  const currentHuman = runs[runIdx] ?? null;
  const humansThisRun = sequential ? [currentHuman!] : [...(currentHuman !== null ? [currentHuman] : []), ...remoteHumans];

  const onHumanState = useCallback((s: ChallengeState) => {
    if (currentHuman === null) return;
    live.current.set(currentHuman, s);
    const rec = recordings.current.get(currentHuman) ?? [];
    rec.push({ t: snapRef.current.elapsed, s });
    recordings.current.set(currentHuman, rec);
  }, [currentHuman]);

  const sample = (id: number, t: number): ChallengeState | undefined => {
    const rec = recordings.current.get(id);
    if (!rec || rec.length === 0) return undefined;
    let best = rec[0].s;
    for (const r of rec) {
      if (r.t > t) break;
      best = r.s;
    }
    return best;
  };

  const ready = () => setSnap((s) => ({ ...s, step: 'countdown', countdown: COUNTDOWN, elapsed: 0 }));
  const fastForward = () => {
    timeScale.current = timeScale.current === 1 ? 4 : 1;
    setSnap((s) => ({ ...s, timeScale: timeScale.current }));
  };

  const finishRun = () => {
    for (const id of humansThisRun) {
      const s = live.current.get(id) ?? (getRemoteState?.(id)) ?? { ...IDLE_STATE, fallen: def.style === 'endurance', done: def.style === 'endurance' };
      finals.current.set(id, s);
    }
    if (runIdx + 1 < runs.length) {
      setRunIdx(runIdx + 1);
      finishedAt.current = null;
      timeScale.current = 1;
      setSnap({ step: 'ready', currentHuman: runs[runIdx + 1], elapsed: 0, countdown: COUNTDOWN, states: {}, timeScale: 1 });
    } else {
      const result: Record<number, ChallengeState> = {};
      for (const id of challenge.participants) {
        const plan = plans.get(id);
        result[id] = finals.current.get(id) ?? (plan ? plan(def.duration * 1.5) : { ...IDLE_STATE, fallen: true, done: true });
      }
      statesRef.current = result;
      const done: RunnerSnapshot = { ...snapRef.current, step: 'done', states: result };
      setSnap(done);
      onTick?.(done);
    }
  };

  useEffect(() => {
    if (snap.step !== 'countdown' && snap.step !== 'playing') return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = ((now - last) / 1000) * timeScale.current;
      last = now;
      const cur = snapRef.current;
      if (cur.step === 'countdown') {
        const c = cur.countdown - dt / timeScale.current;
        const next: RunnerSnapshot = c <= 0 ? { ...cur, step: 'playing', countdown: 0, elapsed: 0 } : { ...cur, countdown: c };
        setSnap(next);
        onTick?.(next);
        return;
      }
      const t = cur.elapsed + dt;
      const states: Record<number, ChallengeState> = {};
      for (const pid of challenge.participants) {
        const plan = plans.get(pid);
        if (plan) states[pid] = plan(t);
        else if (pid === currentHuman) states[pid] = live.current.get(pid) ?? IDLE_STATE;
        else if (remoteHumans.includes(pid) && !sequential) states[pid] = getRemoteState?.(pid) ?? IDLE_STATE;
        else states[pid] = finals.current.has(pid) ? sample(pid, t) ?? finals.current.get(pid)! : IDLE_STATE;
      }
      statesRef.current = states;
      const humansDone = humansThisRun.every((h) => states[h]?.done || states[h]?.fallen);
      const botsDone = [...plans.keys()].every((b) => states[b]?.done || states[b]?.fallen);
      if (humansDone && finishedAt.current === null) {
        finishedAt.current = t;
        if (humansThisRun.length) timeScale.current = Math.max(timeScale.current, 3);
      }
      const end =
        t >= def.duration + 1 ||
        (humansDone && (botsDone || (finishedAt.current !== null && t - finishedAt.current > (def.style === 'race' ? 4 : 25))));
      const next: RunnerSnapshot = { ...cur, elapsed: t, states, timeScale: timeScale.current };
      setSnap(next);
      onTick?.(next);
      if (end) finishRun();
    }, 100);
    return () => window.clearInterval(id);
  }, [snap.step, runIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete(statesRef.current);
  };

  return { snap, statesRef, onHumanState, ready, fastForward, complete };
}
