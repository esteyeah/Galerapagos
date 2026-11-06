import type { ChallengeId } from '../../../engine/kohlanta';
import type { MinigameProps } from './common';
import Parcours from './Parcours';
import Balance from './Balance';
import Orientation from './Orientation';
import Totems from './Totems';
import Cocos from './Cocos';
import Puzzle from './Puzzle';

export function Minigame({ game, ...props }: MinigameProps & { game: ChallengeId }) {
  switch (game) {
    case 'parcours':
      return <Parcours {...props} />;
    case 'paresseux':
    case 'poteaux':
      return <Balance {...props} game={game} />;
    case 'orientation':
      return <Orientation {...props} />;
    case 'totems':
      return <Totems {...props} />;
    case 'cocos':
      return <Cocos {...props} />;
    case 'puzzle':
      return <Puzzle {...props} />;
  }
}
