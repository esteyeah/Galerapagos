import { useRef, useState } from 'react';
import type { ChallengeState, KLView } from '../../engine/kohlanta';
import type { ClientSession } from '../../net/client';
import ChallengeStage from './ChallengeStage';

/** Épreuve côté invité : l'hôte diffuse l'état de tous, on joue son propre mini-jeu. */
export default function ClientChallenge({ session, view }: { session: ClientSession; view: KLView }) {
  const ch = view.challenge!;
  const tick = session.challenge && session.challenge.seed === ch.seed ? session.challenge : null;
  const seat = session.seat;
  const plays = seat !== null && ch.participants.includes(seat);
  const mine = useRef<ChallengeState | null>(null);
  const [, force] = useState(0);
  const onLocal = (s: ChallengeState) => {
    mine.current = s;
    session.sendChallengeState(ch.seed, s);
    force((x) => x + 1);
  };
  const states = { ...(tick?.states ?? {}) };
  if (plays && mine.current) states[seat!] = mine.current;
  const step = !tick ? 'countdown' : tick.step === 'ready' ? 'countdown' : tick.step;
  return (
    <ChallengeStage
      challenge={ch}
      players={view.players}
      teams={view.teams}
      viewerId={view.viewerId}
      step={step}
      elapsed={tick?.elapsed ?? 0}
      countdown={tick?.countdown ?? 3}
      states={states}
      currentHuman={plays ? seat : null}
      onLocalState={onLocal}
      timeScale={tick?.timeScale}
      waitingLabel={plays ? undefined : '👀 Vous regardez l’épreuve.'}
    />
  );
}
