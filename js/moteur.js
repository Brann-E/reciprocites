// Moteur de dimensionnement : fonctions pures, sans DOM.
// Entrée : les réponses saisies. Sortie : la lecture (position, écart, alertes).

export const NIVEAUX = ['faible', 'moyenne', 'forte'];

// Seuil entre deux zones sur la Boussole : un tiers de l'axe de chaque côté du centre.
export const SEUIL = 1 / 3;

// Score continu de -1 à +1, fidèle à la règle de majorité :
// au-delà de +1/3, « forte » réunit plus de la moitié des réponses ;
// en deçà de -1/3, c'est « faible » ; entre les deux, aucune majorité.
export function scoreAxe(compte, repondus) {
  if (!repondus) return 0;
  const forte = compte.forte / repondus;
  const faible = compte.faible / repondus;
  if (forte > 0.5) return SEUIL + (forte - 0.5) * 2 * (1 - SEUIL);
  if (faible > 0.5) return -(SEUIL + (faible - 0.5) * 2 * (1 - SEUIL));
  return (forte - faible) * 2 * SEUIL;
}

export function niveauAxe(reponses, criteres) {
  const total = criteres.length;
  const valeurs = criteres.map((c) => reponses[c.id]).filter(Boolean);
  const compte = Object.fromEntries(NIVEAUX.map((n) => [n, valeurs.filter((v) => v === n).length]));
  const repondus = valeurs.length;
  const minimum = Math.ceil(total / 2);
  const score = scoreAxe(compte, repondus);
  if (repondus < minimum) {
    return { niveau: null, score, compte, repondus, total, minimum };
  }
  const majorite = repondus / 2;
  let niveau = 'moyenne';
  if (compte.forte > majorite) niveau = 'forte';
  else if (compte.faible > majorite) niveau = 'faible';
  return { niveau, score, compte, repondus, total, minimum };
}

// Cercles de proximité : rang 1 = le plus proche, le centre (rang 0) = le porteur.
// Un « saut » = un cercle occupé séparé du lien le plus proche par au moins un cercle vide.
export function lireCercles(places, cercles) {
  const groupes = cercles.map((cercle, i) => ({
    ...cercle,
    rang: i + 1,
    places: places.filter((p) => p.cercle === i + 1),
  }));
  const sauts = [];
  let precedent = 0;
  for (const groupe of groupes) {
    if (!groupe.places.length) continue;
    if (groupe.rang - precedent >= 2) sauts.push({ depuis: precedent, vers: groupe.rang });
    precedent = groupe.rang;
  }
  return { groupes, sauts, total: places.length };
}

export function lirePosition(complexite, capacite, positions) {
  if (!complexite || !capacite) return null;
  const id = positions.matrice[complexite][capacite];
  const confirmee = positions.sourcees.some(([cx, cap]) => cx === complexite && cap === capacite);
  return { id, confirmee, ...positions.positions[id] };
}

export function croiser(positionId, niveauObjectif, capacite, croisement) {
  const regle = croisement.regles.find(
    (r) =>
      r.position === positionId &&
      (!r.capacite || r.capacite === capacite) &&
      niveauObjectif >= r.niveau[0] &&
      niveauObjectif <= r.niveau[1],
  );
  return regle ? regle.lecture : croisement.defaut;
}

export function lireAlertes(coches, signaux) {
  return signaux.categories.filter((categorie) => coches.includes(categorie.id));
}

export function lire(etat, donnees) {
  const complexite = niveauAxe(etat.reponses, donnees.criteres.complexite.criteres);
  const capacite = niveauAxe(etat.reponses, donnees.criteres.capacite.criteres);
  const position = lirePosition(complexite.niveau, capacite.niveau, donnees.positions);
  const objectif = donnees.objectifs.find((o) => o.id === etat.objectif) ?? null;
  const ecart =
    position && objectif
      ? croiser(position.id, objectif.niveau, capacite.niveau, donnees.positions.croisement)
      : null;
  return {
    complexite,
    capacite,
    position,
    objectif,
    ecart,
    cercles: lireCercles(etat.places, donnees.cercles),
    alertes: lireAlertes(etat.signaux, donnees.signaux),
  };
}
