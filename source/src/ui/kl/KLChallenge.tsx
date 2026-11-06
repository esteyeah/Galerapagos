import type { ChallengeInfo, ChallengeState, KLView } from '../../engine/kohlanta';
import ChallengeStage from './ChallengeStage';
import { useChallengeRunner, type RunnerSnapshot } from './useChallengeRunner';

interface Props {
  view: KLView;
  challenge: ChallengeInfo;
  localHumans: number[];
  remoteHumans?: number[];
  getRemoteState?: (id: number) => ChallengeState | undefined;
  onComplete: (states: Record<number, ChallengeState>) => void;
  onTick?: (snap: RunnerSnapshot) => void;
  autoStart?: boolean;
}

/** Épreuve jouée sur cet appareil (partie locale ou hôte en ligne). */
export default function KLChallenge({ view, challenge, localHumans, remoteHumans = [], getRemoteState, onComplete, onTick, autoStart }: Props) {
  const runner = useChallengeRunner({ challenge, players: view.players, localHumans, remoteHumans, getRemoteState, onComplete, onTick, autoStart });
  const { snap } = runner;
  return (
    <ChallengeStage
      challenge={challenge}
      players={view.players}
      teams={view.teams}
      viewerId={view.viewerId}
      step={snap.step}
      elapsed={snap.elapsed}
      countdown={snap.countdown}
      states={snap.states}
      statesRef={runner.statesRef}
      currentHuman={snap.currentHuman}
      onLocalState={runner.onHumanState}
      onReady={runner.ready}
      onFastForward={runner.fastForward}
      onContinue={runner.complete}
      timeScale={snap.timeScale}
      waitingLabel={localHumans.length === 0 ? '👀 Vous regardez l’épreuve (vous n’y participez pas).' : undefined}
    />
  );
}
