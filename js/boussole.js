// La Boussole : croise « Ce que ça pèse » (vertical) et « Ce qu'on peut porter » (horizontal).
// Le centre est l'équilibre. Chaque réponse déplace le point ; la zone où il se trouve donne la position.

import { svg } from './dom.js';
import { NIVEAUX, SEUIL } from './moteur.js';

const ECHELLE = 120;
const BORNES = [-1, -SEUIL, SEUIL, 1];
const MARGE = { normale: 170, compacte: 150 };

const niveauDe = (score) => (score > SEUIL ? 'forte' : score < -SEUIL ? 'faible' : 'moyenne');
const moyenne = (liste) => liste.reduce((a, b) => a + b, 0) / liste.length;

export function dessinerBoussole(lecture, positions, { compacte = false } = {}) {
  const { complexite, capacite } = lecture;
  const m = compacte ? MARGE.compacte : MARGE.normale;
  const entame = complexite.repondus > 0 || capacite.repondus > 0;
  const complete = Boolean(complexite.niveau && capacite.niveau);
  const zoneActive = entame ? `${niveauDe(complexite.score)}-${niveauDe(capacite.score)}` : null;
  const idActif = entame ? positions.matrice[niveauDe(complexite.score)][niveauDe(capacite.score)] : null;

  const description = entame
    ? `Boussole : position ${positions.positions[idActif].nom}${complete ? '' : ', provisoire'}.`
    : 'Boussole : aucune réponse pour le moment, le point est au centre.';

  const racine = svg('svg', {
    viewBox: `${-m} ${-m} ${m * 2} ${m * 2}`,
    class: compacte ? 'boussole compacte' : 'boussole',
    role: 'img',
    'aria-label': description,
  });

  const centres = {};
  NIVEAUX.forEach((ncx, i) =>
    NIVEAUX.forEach((ncap, j) => {
      const x0 = BORNES[j] * ECHELLE;
      const x1 = BORNES[j + 1] * ECHELLE;
      const y0 = -BORNES[i + 1] * ECHELLE;
      const y1 = -BORNES[i] * ECHELLE;
      racine.append(
        svg('rect', {
          x: x0,
          y: y0,
          width: x1 - x0,
          height: y1 - y0,
          class: zoneActive === `${ncx}-${ncap}` ? 'zone actuelle' : 'zone',
        }),
      );
      const id = positions.matrice[ncx][ncap];
      (centres[id] ??= []).push([(x0 + x1) / 2, (y0 + y1) / 2]);
    }),
  );

  for (const [id, points] of Object.entries(centres)) {
    racine.append(
      svg(
        'text',
        {
          x: moyenne(points.map((p) => p[0])),
          y: moyenne(points.map((p) => p[1])),
          class: id === idActif ? 'zone-nom actif' : 'zone-nom',
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
        },
        positions.positions[id].nom,
      ),
    );
  }

  const bord = ECHELLE + 10;
  racine.append(
    svg('line', { x1: -ECHELLE, y1: 0, x2: ECHELLE, y2: 0, class: 'axe-ligne' }),
    svg('line', { x1: 0, y1: -ECHELLE, x2: 0, y2: ECHELLE, class: 'axe-ligne' }),
    svg('text', { x: 0, y: -bord, class: 'axe-nom', 'text-anchor': 'middle' }, 'ça pèse lourd'),
    svg('text', { x: 0, y: bord, class: 'axe-nom', 'text-anchor': 'middle', 'dominant-baseline': 'hanging' }, 'ça pèse peu'),
    svg('text', { x: 0, y: 0, class: 'axe-nom', 'text-anchor': 'middle', transform: `translate(${-bord} 0) rotate(-90)` }, 'on porte peu'),
    svg('text', { x: 0, y: 0, class: 'axe-nom', 'text-anchor': 'middle', transform: `translate(${bord} 0) rotate(90)` }, 'on porte beaucoup'),
    svg('circle', { r: 3, class: 'equilibre' }),
  );

  if (entame) {
    const x = capacite.score * ECHELLE;
    const y = -complexite.score * ECHELLE;
    racine.append(
      svg('line', { x1: 0, y1: 0, x2: x, y2: y, class: 'trajet' }),
      svg('circle', { cx: x, cy: y, r: compacte ? 7 : 9, class: complete ? 'point' : 'point provisoire' }),
    );
  }

  return racine;
}
