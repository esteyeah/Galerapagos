import { CARD_DEFS, MAX_DISEASES, WOOD_PER_PLACE } from '../../engine';

export default function RulesContent() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-300">
      <h2 className="font-display text-2xl text-amber-300">Règles</h2>
      <p>
        <b>But :</b> quitter l'île tous ensemble. Il faut <b>une place de radeau par survivant</b> ({WOOD_PER_PLACE} 🪵 par place) et, après le repas du soir,
        <b> 1 💧 et 1 🐟 par survivant</b> pour le voyage. Les survivants gagnent ensemble.
      </p>
      <p>
        <b>Chaque jour</b>, chacun fait <b>une action</b> :
      </p>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          🎣 <b>Pêcher</b>, 💧 <b>recueillir l'eau</b> ou 🪓 <b>couper du bois</b> : piochez de 1 à 6 boules dans le sac (6 ⚪ et 1 ⚫ en normal). Que des blanches ? Vous
          ramenez autant d'objets que de boules piochées. Une noire ? Vous ne ramenez rien et tombez malade.
        </li>
        <li>🛳️ <b>Fouiller l'épave</b> : piochez une carte secrète, sans risque.</li>
        <li>😴 <b>Se reposer</b> : passez votre tour et guérissez d'une maladie.</li>
      </ul>
      <p>
        <b>Maladies :</b> on peut agir malade, mais à <b>{MAX_DISEASES} maladies, on meurt</b>. Une trousse de secours soigne une maladie.
      </p>
      <p>
        <b>Le soir</b>, la tribu consomme 1 💧 et 1 🐟 par survivant. En cas de manque, chacun peut partager ses cartes. Sinon, la tribu vote pour désigner qui s'en passera,
        une personne par portion manquante : elle tombe malade (et meurt si elle l'était déjà). Égalité : tirage au sort entre les ex aequo. Le 🔫 fusil permet d'abattre
        quelqu'un pendant un vote ; la 🛡️ plaque de tôle protège d'une désignation ou d'une balle.
      </p>
      <p>
        <b>Cartes :</b> elles sont cachées, mais vous pouvez en <b>montrer</b> à tous (définitif). Pendant votre tour, vous pouvez <b>donner</b> une carte ou{' '}
        <b>proposer un échange</b> (l'autre choisit sa carte en retour ou refuse). Le 🛶 bateau gonflable troué et le 🩹 scotch, une fois posés tous les deux, comptent
        comme une place de radeau.
      </p>
      <p>
        <b>Départ :</b> dès que le radeau et les vivres suffisent, la tribu vote pour partir. <b>Avec météo</b>, la pluie aide à recueillir l'eau, le soleil de plomb
        l'empêche, et le jour de l'ouragan le radeau part de force : ceux qui n'ont pas de place sont désignés par vote. <b>Sans météo</b>, pas d'ouragan : la partie ne
        se termine que par l'évasion ou la mort de tous.
      </p>
      <h3 className="pt-2 font-display text-lg text-amber-200">Objets de l'épave</h3>
      <ul className="grid gap-1 sm:grid-cols-2">
        {Object.values(CARD_DEFS).map((c) => (
          <li key={c.type}>
            {c.emoji} <b>{c.name}</b> — {c.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
