# 🏝️ Naufragés

Jeu de survie et de trahison au tour par tour, pour 3 à 8 joueurs, dans le navigateur.
Construisez le radeau, remplissez les réserves, et quittez l'île… quitte à laisser quelqu'un derrière.

- **Jouer** : la page GitHub Pages de ce dépôt (le fichier `index.html` à la racine).
- **Hors ligne** : solo contre des bots ou pass-and-play.
- **En ligne** : « Créer une partie en ligne », puis partagez le code de 5 lettres ou le lien d'invitation.

## Organisation du dépôt

- `index.html` et `assets/` : le site compilé, servi par GitHub Pages (ne pas modifier à la main).
- `source/` : le code du jeu (React, TypeScript, Tailwind). Voir [`source/README.md`](source/README.md).
- `.github/workflows/build.yml` : recompile le site automatiquement à chaque modification de `source/`.

L'ancienne version du jeu (v32, fichier unique) reste disponible dans l'historique git.
