// Fabriques d'éléments partagées par tous les modules de l'écran.

const NS_SVG = 'http://www.w3.org/2000/svg';

const remplir = (noeud, props, enfants, estSvg) => {
  for (const [cle, valeur] of Object.entries(props)) {
    if (valeur == null || valeur === false) continue;
    if (cle === 'class' && !estSvg) noeud.className = valeur;
    else if (cle.startsWith('on')) noeud.addEventListener(cle.slice(2), valeur);
    else noeud.setAttribute(cle, valeur === true ? '' : valeur);
  }
  noeud.append(...enfants.flat(Infinity).filter((e) => e != null && e !== false));
  return noeud;
};

export const el = (tag, props = {}, ...enfants) => remplir(document.createElement(tag), props, enfants, false);

export const svg = (tag, props = {}, ...enfants) => remplir(document.createElementNS(NS_SVG, tag), props, enfants, true);

export const sansAccents = (texte) =>
  texte.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
