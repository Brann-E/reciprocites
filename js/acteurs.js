// Les réciprenants : entre qui et qui se fait la réciprocité.
// On ajoute un acteur depuis la liste des types, puis on précise son nom,
// son rôle (concerné, contribue, bénéficie, impacté) et sa distance à vous.

import { el, sansAccents } from './dom.js';

const nouvelId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function creerActeurs({ cercles, familles, roles, lirePlaces, ajouter, modifier, retirer }) {
  const types = new Map(familles.flatMap((f) => f.types.map((t) => [t.id, t])));
  const lignes = new Map();
  let aFocaliser = null;

  // --- choix d'un type ---
  const recherche = el('input', {
    type: 'search',
    class: 'champ-petit recherche',
    placeholder: 'Chercher un type d’acteur : commune, association, artisan…',
    'aria-label': 'Chercher un type d’acteur',
  });
  const blocsFamilles = familles.map((famille) => {
    const boutons = famille.types.map((t) => {
      const b = el('button', { type: 'button', class: 'puce', 'data-cle': sansAccents(`${t.titre} ${famille.nom}`) }, `+ ${t.titre}`);
      b.addEventListener('click', () => {
        const uid = nouvelId();
        aFocaliser = uid;
        ajouter({ uid, type: t.id, nom: '', roles: [], cercle: null });
      });
      return b;
    });
    return [el('div', { class: 'famille' }, el('h3', { class: 'etiquette' }, famille.nom), el('div', { class: 'puces' }, boutons)), boutons];
  });
  recherche.addEventListener('input', () => {
    const q = sansAccents(recherche.value.trim());
    for (const [bloc, boutons] of blocsFamilles) {
      let visibles = 0;
      for (const b of boutons) {
        b.hidden = Boolean(q) && !b.dataset.cle.includes(q);
        if (!b.hidden) visibles++;
      }
      bloc.hidden = visibles === 0;
    }
  });

  // --- une ligne par réciprenant ---
  const creerLigne = (place) => {
    const pressables = [];
    const bascule = (classe, texte, titre, estActif, agir) => {
      const b = el('button', { type: 'button', class: classe, 'aria-pressed': 'false', title: titre }, texte);
      b.addEventListener('click', agir);
      pressables.push(() => b.setAttribute('aria-pressed', String(estActif())));
      return b;
    };
    const courante = () => lirePlaces().find((p) => p.uid === place.uid);

    const nom = el('input', {
      type: 'text',
      class: 'champ-petit',
      maxlength: '60',
      placeholder: 'Le nommer (facultatif)',
      'aria-label': `Nom de cet acteur (${types.get(place.type)?.titre ?? place.type})`,
      value: place.nom,
    });
    nom.addEventListener('input', () => modifier(place.uid, { nom: nom.value.trim() }));

    const choixRoles = roles.map((r) =>
      bascule('puce', r.titre, r.aide, () => courante()?.roles.includes(r.id), () => {
        const actuels = courante().roles;
        modifier(place.uid, { roles: actuels.includes(r.id) ? actuels.filter((x) => x !== r.id) : [...actuels, r.id] });
      }),
    );

    const choixDistance = cercles.map((c, i) =>
      bascule('seg', c.nom, c.aide, () => courante()?.cercle === i + 1, () => {
        modifier(place.uid, { cercle: courante().cercle === i + 1 ? null : i + 1 });
      }),
    );

    const enlever = el('button', { type: 'button', class: 'bouton-discret' }, 'Retirer');
    enlever.addEventListener('click', () => retirer(place.uid));

    const ligne = el(
      'li',
      { class: 'reciprenant' },
      el('div', { class: 'reciprenant-tete' }, el('span', { class: 'cat-nom' }, types.get(place.type)?.titre ?? place.type), nom, enlever),
      el('div', { class: 'reciprenant-ligne' }, el('span', { class: 'mini-etiquette' }, 'Rôle'), el('div', { class: 'puces' }, choixRoles)),
      el('div', { class: 'reciprenant-ligne' }, el('span', { class: 'mini-etiquette' }, 'Distance à vous'), el('div', { class: 'distances' }, choixDistance)),
    );
    return { ligne, nom, maj: () => pressables.forEach((f) => f()) };
  };

  const liste = el('ol', { class: 'reciprenants' });
  const vide = el('p', { class: 'attente' }, 'Aucun réciprenant pour le moment. Ajoutez-en depuis la liste ci-dessous.');

  const element = el(
    'div',
    { class: 'acteurs' },
    vide,
    liste,
    el('div', { class: 'ajout' }, el('div', { class: 'etiquette' }, 'Ajouter un réciprenant'), recherche, el('div', { class: 'palette' }, blocsFamilles.map(([bloc]) => bloc))),
  );

  function maj() {
    const places = lirePlaces();
    const presents = new Set(places.map((p) => p.uid));
    for (const [uid, l] of lignes) {
      if (!presents.has(uid)) {
        l.ligne.remove();
        lignes.delete(uid);
      }
    }
    for (const place of places) {
      if (!lignes.has(place.uid)) {
        const l = creerLigne(place);
        lignes.set(place.uid, l);
        liste.append(l.ligne);
      }
      lignes.get(place.uid).maj();
    }
    vide.hidden = places.length > 0;
    if (aFocaliser && lignes.has(aFocaliser)) {
      const l = lignes.get(aFocaliser);
      l.ligne.scrollIntoView({ block: 'nearest' });
      l.nom.focus();
      aFocaliser = null;
    }
  }

  return { element, maj };
}
