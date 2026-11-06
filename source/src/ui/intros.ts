/** Histoires d'introduction : une différente est tirée à chaque nouvelle partie. */
export interface IntroStory {
  id: number;
  title: string;
  icon: string;
  paragraphs: string[];
}

export const INTROS: IntroStory[] = [
  {
    id: 0,
    title: 'Vol 714, destination nulle part',
    icon: '✈️',
    paragraphs: [
      "Le commandant venait d'annoncer la descente vers Papeete quand le premier réacteur a toussé. Puis le second s'est tu.",
      "Pendant de longues minutes, l'avion a plané au-dessus d'un océan d'un bleu insolent. Les masques à oxygène se balançaient comme des fruits trop mûrs.",
      "Le choc contre le lagon a arraché les ailes. Quand vous avez rouvert les yeux, la carlingue fumait sur le récif, et une poignée de survivants titubaient sur le sable blanc.",
      "À la radio de bord, un dernier bulletin grésille : une dépression tropicale se creuse au large. Il va falloir construire un radeau. Et vite.",
    ],
  },
  {
    id: 1,
    title: 'Le dernier voyage du Belle-Hélène',
    icon: '⛵',
    paragraphs: [
      "Trois semaines de croisière à la voile, promettait la brochure. Cocktails au coucher du soleil et dauphins à la proue.",
      "La nuit du onzième jour, le Belle-Hélène a heurté un récif que personne n'avait vu sur la carte. La coque s'est ouverte comme une boîte de conserve.",
      "Vous avez nagé vers la seule lumière visible : la lune, reflétée sur une plage inconnue. Au matin, l'épave gisait à cent mètres du rivage, couchée sur le flanc.",
      "Le capitaine n'a pas survécu. Mais son baromètre, lui, fonctionne encore. Et l'aiguille ne cesse de baisser.",
    ],
  },
  {
    id: 2,
    title: "L'hydravion du docteur Morel",
    icon: '🛩️',
    paragraphs: [
      "Le docteur Morel avait affrété un vieil hydravion pour une mission scientifique : compter les tortues des atolls perdus. Vous étiez ses assistants, ses étudiants, ou simplement des passagers de dernière minute.",
      "Au-dessus de l'archipel, le moteur a pris feu. Morel a réussi à amerrir dans une baie abritée avant que l'appareil ne s'enfonce lentement, la queue en l'air.",
      "Le docteur a disparu dans la jungle le premier soir en criant qu'il allait chercher de l'aide. On ne l'a jamais revu.",
      "Il vous reste ses carnets, quelques caisses de matériel et la certitude qu'un ouragan remonte vers le nord.",
    ],
  },
  {
    id: 3,
    title: 'Cargo en perdition',
    icon: '🚢',
    paragraphs: [
      "Le cargo Orion transportait des conteneurs de jouets, de conserves et de pièces détachées. Et, à l'insu de la compagnie, quelques passagers clandestins.",
      "La tempête l'a cassé en deux en pleine nuit. Les conteneurs ont dérivé pendant des heures avant de s'échouer, avec vous, sur une île minuscule.",
      "Au lever du jour, la plage ressemble à un marché aux puces : des peluches gorgées d'eau, des boîtes cabossées, une hache encore emballée.",
      "Sur l'horizon, les nuages s'empilent comme des montagnes noires. Ce qui a coulé l'Orion n'en a pas fini avec vous.",
    ],
  },
  {
    id: 4,
    title: 'Télé-réalité : la dernière saison',
    icon: '📺',
    paragraphs: [
      "L'émission promettait « l'aventure ultime ». Huit candidats lâchés sur une île, des caméras partout, et une équipe de production à dix minutes en bateau.",
      "Le troisième soir, les caméras se sont éteintes. Le bateau de la production n'est jamais revenu. Plus de talkie-walkie, plus de régisseur, plus de règles.",
      "Le décor en carton-pâte s'effondre déjà sous la pluie. Les rations prévues pour une semaine ne dureront pas.",
      "Ce n'est plus un jeu. Enfin… si, mais il n'y a plus de public. Seulement vous, l'île, et un ciel qui s'assombrit.",
    ],
  },
  {
    id: 5,
    title: 'Le dirigeable Albatros',
    icon: '🎈',
    paragraphs: [
      "Une croisière en dirigeable au-dessus du Pacifique : l'idée semblait romantique. Champagne, vue imprenable, et le doux ronron des hélices.",
      "Une rafale a déchiré l'enveloppe. Le ballon a perdu de l'altitude pendant une heure interminable, larguant tout ce qui pouvait l'alléger.",
      "La nacelle a fini sa course dans la cime des palmiers. Vous en êtes descendus un par un, griffés, choqués, vivants.",
      "Les cartes de navigation de l'Albatros sont formelles : aucune route maritime ne passe par ici. Si vous voulez revoir la civilisation, il faudra la rejoindre vous-mêmes.",
    ],
  },
  {
    id: 6,
    title: 'Vol charter 22B',
    icon: '🛬',
    paragraphs: [
      "Un charter rempli de vacanciers en chemises à fleurs. Le pilote plaisantait au micro, le steward distribuait des chips au paprika.",
      "Puis il y a eu l'orage. L'éclair a frappé l'aile gauche, les lumières ont clignoté, et l'avion a piqué vers la mer dans un hurlement collectif.",
      "Le fuselage s'est échoué en morceaux le long d'une plage déserte. Les valises éventrées ont répandu des maillots de bain, des crèmes solaires et des souvenirs qui ne serviront à rien.",
      "La saison des cyclones vient de commencer. Personne ne viendra vous chercher à temps.",
    ],
  },
  {
    id: 7,
    title: 'Le radeau de la Méduse, version 2.0',
    icon: '🛟',
    paragraphs: [
      "Le paquebot de luxe a pris feu à trois heures du matin. Dans la panique, votre canot de sauvetage a été mis à l'eau à moitié vide, sans rames ni provisions.",
      "Vous avez dérivé quatre jours sous un soleil écrasant, à vous partager une bouteille d'eau et des regards de plus en plus méfiants.",
      "Le cinquième jour, une île est apparue. Le canot s'est éventré sur les coraux, mais vous avez touché terre.",
      "Le sable est chaud, les cocotiers sont là, et l'ambiance est déjà tendue. Il faudra apprendre à s'entraider… ou pas.",
    ],
  },
  {
    id: 8,
    title: "L'expédition oubliée",
    icon: '🗺️',
    paragraphs: [
      "Une agence d'aventure vendait des séjours « hors des sentiers battus ». Elle n'a pas menti : le petit avion bimoteur s'est posé en catastrophe sur une piste qui n'existait plus depuis cinquante ans.",
      "Le train d'atterrissage a cédé, l'appareil a fini dans les fougères. Le guide s'est cassé les deux jambes ; il vous a confié sa boussole avant de perdre connaissance.",
      "Autour de la piste, les restes d'un ancien camp : des tôles rouillées, des caisses vides, une vieille épave échouée sur la plage voisine.",
      "D'après le guide, à chaque fin de saison un ouragan balaie l'île. Et la saison se termine bientôt.",
    ],
  },
];

/** Histoires d'arrivée pour le mode Koh Lanta. */
export const KL_INTROS: IntroStory[] = [
  {
    id: 100,
    title: 'Le grand départ',
    icon: '🚤',
    paragraphs: [
      "Les bateaux ralentissent à quelques centaines de mètres d'une plage immaculée. Le capitaine coupe les moteurs : « À partir d'ici, c'est à la nage. »",
      "Chacun saute avec son maigre sac étanche. L'eau est chaude, le courant traître, et les premières alliances se nouent déjà dans les vagues.",
      "Sur le sable, un drapeau de couleur attend chaque équipe, avec une machette, une marmite et quelques poignées de riz.",
      "Les épreuves commencent demain. Le premier conseil, dans trois jours. Que l'aventure commence !",
    ],
  },
  {
    id: 101,
    title: "L'île aux totems",
    icon: '🗿',
    paragraphs: [
      "On raconte que les anciens habitants de l'île y sculptaient des totems pour honorer ceux qui survivaient à la saison des pluies.",
      "Cette année, ce sont des aventuriers venus de partout qui débarquent, sans nourriture, sans abri, sans feu.",
      "Au centre de l'île, un vieux totem semble les observer. Quelque part dans la jungle, un collier d'immunité serait caché.",
      "Seul un aventurier repartira avec le titre. Les autres verront leur flamme s'éteindre au conseil.",
    ],
  },
  {
    id: 102,
    title: 'Parachutés au bout du monde',
    icon: '🪂',
    paragraphs: [
      "L'hélicoptère survole l'archipel pendant de longues minutes avant de se stabiliser au-dessus d'une baie turquoise.",
      "« Sautez ! » Un par un, les aventuriers plongent dans le lagon et nagent jusqu'à la rive, où les attend la première surprise : leurs équipes sont déjà formées.",
      "Il faudra construire un abri, allumer un feu, pêcher, et surtout s'entendre… jusqu'à la réunification.",
      "Car tôt ou tard, il n'y aura plus d'équipes. Seulement des individus, et un jury qui se souviendra de tout.",
    ],
  },
];

const LAST_KEY = 'naufrages.lastIntro';

/** Tire une histoire différente de la précédente. */
export function pickIntroId(mode: 'classique' | 'kohlanta' = 'classique'): number {
  const pool = mode === 'kohlanta' ? KL_INTROS : INTROS;
  let last = -1;
  try {
    last = Number(localStorage.getItem(LAST_KEY) ?? -1);
  } catch {
    /* ignore */
  }
  const choices = pool.filter((s) => s.id !== last);
  const id = choices[Math.floor(Math.random() * choices.length)].id;
  try {
    localStorage.setItem(LAST_KEY, String(id));
  } catch {
    /* ignore */
  }
  return id;
}
