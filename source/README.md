# 🏝️ Naufragés

Jeu de survie et de trahison au tour par tour, pour 3 à 8 joueurs.
Construisez le radeau, remplissez les réserves d'eau et de nourriture, et quittez l'île… quitte à laisser quelqu'un derrière.

- **Hors ligne** : solo contre des bots, ou pass-and-play sur un même appareil.
- **En ligne** : un joueur crée un salon (code de 5 lettres), les autres le rejoignent depuis leur navigateur. Des bots peuvent compléter la partie, chacun avec son caractère (coopératif, égoïste, paranoïaque).
- **Modes** : avec météo et ouragan, ou sans météo (fin uniquement par l'évasion ou la mort de tous). Trois difficultés : facile, normal, difficile.
- Une histoire d'introduction différente à chaque partie, musique et bruitages générés dans le navigateur.

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests du moteur
npm run demo -- 7 normal meteo         # partie de bots dans la console
npm run sim -- 300 5 normal meteo      # statistiques d'équilibrage
npm run build      # site statique dans dist/
```

## Publier sur GitHub Pages

Le workflow `.github/workflows/build.yml` (à la racine du dépôt) teste et recompile le site à chaque modification de `source/`, puis copie le résultat à la racine, servie par GitHub Pages (branche `main`, dossier racine).
Pour recompiler à la main : `npm run publish:root` depuis `source/`.

## Comment marche le jeu en ligne ?

GitHub Pages n'héberge que des fichiers statiques, sans serveur. Le jeu en ligne passe donc en **pair-à-pair (WebRTC, via PeerJS)** :

- le navigateur de l'hôte fait tourner la partie et les bots ; il doit rester ouvert ;
- chaque joueur ne reçoit que ce qu'il a le droit de voir (sa main, les cartes montrées…) ;
- la mise en relation utilise le serveur public gratuit de PeerJS (`0.peerjs.com`) ;
- un joueur qui recharge sa page retrouve sa place ; s'il part, l'hôte peut le remplacer par un bot.

Limite connue : certains réseaux très fermés (entreprise, certains réseaux mobiles) bloquent les connexions pair-à-pair directes.

## Architecture

```
src/engine/   Moteur pur (sans interface) : GameEngine, Player, Deck, VoteSystem, cartes, bots, vue filtrée
src/net/      Jeu en ligne : protocole, session hôte, session invité (PeerJS)
src/ui/       React + Tailwind : menu, intro, plateau, animations, audio
scripts/      Démo console et simulateur d'équilibrage
```
