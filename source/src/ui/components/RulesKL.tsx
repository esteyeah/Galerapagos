import { CHALLENGES, KL_ITEMS, KL_MAX_DISEASES } from '../../engine/kohlanta';

export default function RulesKL() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-300">
      <h2 className="font-display text-2xl text-orange-300">Règles du mode Koh Lanta</h2>
      <p>
        <b>But :</b> être le dernier aventurier… et convaincre le jury final. De 4 à 16 joueurs, en 1 à 4 équipes (1 = chacun pour soi).
      </p>
      <p>
        <b>Cycle de 3 jours :</b> jour 1, épreuve de confort puis vie de camp ; jour 2, épreuve d'immunité puis vie de camp ; jour 3, vie de camp puis conseil. En
        équipes, l'équipe dernière à l'immunité va au conseil. Après la réunification (à la moitié des aventuriers), l'immunité devient individuelle.
      </p>
      <p>
        <b>Vie de camp :</b> comme en survie (sac de boules pour pêcher, chercher de l'eau ou couper du bois ; fouiller la jungle ; se reposer). Le bois sert au{' '}
        <b>feu</b> : pour l'allumer, réussissez le mini-jeu de friction (échec : −1 forme). Le feu consomme 1 bois par nuit ; sans feu, l'eau n'est pas bouillie et on
        risque de tomber malade. À <b>{KL_MAX_DISEASES} maladies</b>, c'est l'abandon médical.
      </p>
      <p>
        <b>Forme (0 à 10) :</b> en forme (6 ou plus), chaque récolte réussie rapporte +1 ; en pleine forme (8 ou plus), une boule blanche en plus ; épuisé (3 ou moins), des boules noires en plus. Elle joue aussi sur les épreuves. Elle baisse avec la faim, la soif, les échecs, et remonte avec le repos, le feu et les récompenses.
      </p>
      <p>
        <b>Pour accélérer l'aventure :</b>
      </p>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          🤝 <b>Ambassadeurs</b> : à la réunification, chaque ancienne équipe élit un ambassadeur. Les ambassadeurs proposent chacun un nom : s'ils sont tous
          d'accord, cette personne part ; sinon, le sort élimine l'un des ambassadeurs.
        </li>
        <li>
          ⛓️ <b>Destins liés</b> : pendant un cycle, les aventuriers sont tirés au sort en binômes. Au conseil, l'éliminé emmène son binôme avec lui ; après la
          réunification, l'immunité se gagne en binôme (1 fois par partie, 2 à partir de 12 joueurs).
        </li>
        <li>⚡ <b>Conseils surprises</b> : un soir de jour 1 ou 2, un conseil peut tomber sans prévenir (2 au maximum par partie).</li>
        <li>☠️ <b>Épreuves éliminatoires</b> : parfois, l'épreuve d'immunité devient éliminatoire : le dernier quitte l'aventure sur-le-champ (2 au maximum).</li>
      </ul>
      <p>
        <b>Finale :</b> à 4, course d'orientation (le dernier est éliminé) ; à 3, les poteaux. Le gagnant choisit son adversaire, et le jury (les éliminés après la
        réunification) vote pour le vainqueur.
      </p>
      <h3 className="pt-2 font-display text-lg text-orange-200">Épreuves</h3>
      <ul className="grid gap-1 sm:grid-cols-2">
        {Object.values(CHALLENGES).map((c) => (
          <li key={c.id}>
            {c.emoji} <b>{c.name}</b> ({c.category}{c.finalOnly ? ', finale' : ''}) — {c.description}
          </li>
        ))}
      </ul>
      <h3 className="pt-2 font-display text-lg text-orange-200">Objets de la jungle</h3>
      <ul className="grid gap-1 sm:grid-cols-2">
        {Object.values(KL_ITEMS).map((c) => (
          <li key={c.type}>
            {c.emoji} <b>{c.name}</b> — {c.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
