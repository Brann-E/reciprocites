import { lire, NIVEAUX } from './moteur.js';
import { el } from './dom.js';
import { dessinerBoussole } from './boussole.js';
import { creerActeurs } from './acteurs.js';

const CLE = 'reciprocites.dimensionnement.v1';
const ETAT_VIDE = { cadrage: {}, objectif: null, places: [], reponses: {}, signaux: [] };
const ETAPES = [
  { id: 'atterrir', nom: 'Atterrir' },
  { id: 'reciprenants', nom: 'Les réciprenants' },
  { id: 'pese', nom: 'Ce que ça pèse' },
  { id: 'porter', nom: 'Ce qu’on peut porter' },
  { id: 'signaux', nom: 'Signaux d’alerte' },
];

const lireJson = (nom) =>
  fetch(`data/${nom}.json`).then((reponse) => {
    if (!reponse.ok) throw new Error(`data/${nom}.json : ${reponse.status}`);
    return reponse.json();
  });

const charger = () => {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return structuredClone(ETAT_VIDE);
    const lu = { ...structuredClone(ETAT_VIDE), ...JSON.parse(brut) };
    // versions précédentes : phrase de projet, types d'acteurs sans rôle
    if (lu.projet && !lu.cadrage.nom) lu.cadrage.nom = lu.projet;
    delete lu.projet;
    delete lu.acteurs;
    lu.places = lu.places.map((p) => ({ roles: [], cercle: null, nom: '', ...p }));
    return lu;
  } catch {
    return structuredClone(ETAT_VIDE);
  }
};

const sauver = (etat) => {
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
  } catch {
    // stockage indisponible : l'écran reste utilisable, sans reprise
  }
};

const basculer = (liste, valeur) =>
  liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];

const etapeDuHash = () => ETAPES.find((e) => `#${e.id}` === location.hash)?.id ?? null;

async function demarrer() {
  const zoneSaisie = document.getElementById('saisie');
  const zoneLecture = document.getElementById('lecture');
  const navEtapes = document.getElementById('etapes');
  zoneSaisie.addEventListener('submit', (e) => e.preventDefault());

  let donnees;
  try {
    const noms = ['cadrage', 'objectifs', 'criteres', 'positions', 'signaux', 'acteurs', 'cercles'];
    const lus = await Promise.all(noms.map(lireJson));
    donnees = Object.fromEntries(noms.map((nom, i) => [nom, lus[i]]));
  } catch (erreur) {
    zoneSaisie.replaceChildren(
      el('p', { class: 'avis' }, `Les données n'ont pas pu être chargées (${erreur.message}). Servez ce dossier en HTTP.`),
    );
    return;
  }
  const titresTypes = new Map(donnees.acteurs.flatMap((f) => f.types.map((t) => [t.id, t.titre])));
  const titresRoles = new Map(donnees.cadrage.roles.map((r) => [r.id, r.titre]));

  let etat = charger();
  const enregistrer = () => {
    sauver(etat);
    maj();
  };
  const pressables = [];
  const champs = [];

  const bouton = (classe, texte, estActif, agir, extra = {}) => {
    const b = el('button', { type: 'button', class: classe, 'aria-pressed': 'false', ...extra }, texte);
    b.addEventListener('click', () => {
      agir();
      enregistrer();
    });
    pressables.push(() => b.setAttribute('aria-pressed', String(estActif())));
    return b;
  };

  const entete = (titre, sous) => el('header', { class: 'entete-etape' }, el('h2', {}, titre), sous ? el('p', { class: 'sous-etape' }, sous) : null);

  // ---------- 1. atterrir ----------
  const question = (q) => {
    const id = `q-${q.id}`;
    const champ = q.court
      ? el('input', { type: 'text', id, class: 'champ', maxlength: '120', placeholder: q.aide, value: etat.cadrage[q.id] ?? '' })
      : el('textarea', { id, class: 'champ-texte', rows: '3' }, etat.cadrage[q.id] ?? '');
    champ.addEventListener('input', () => {
      etat.cadrage = { ...etat.cadrage, [q.id]: champ.value };
      enregistrer();
    });
    champs.push(() => (champ.value = etat.cadrage[q.id] ?? ''));
    return el('div', { class: 'question' }, el('label', { for: id, class: 'question-libelle' }, q.libelle), q.court ? null : el('p', { class: 'note' }, q.aide), champ);
  };

  const groupesCadrage = donnees.cadrage.groupes.map((g) =>
    el(
      'section',
      { class: 'bloc groupe-cadrage' },
      el('div', { class: 'groupe-tete' }, el('h3', {}, g.titre), el('p', { class: 'note' }, g.sous)),
      g.questions.map(question),
    ),
  );

  const niveaux = [1, 2, 3, 4].map((n) =>
    el(
      'div',
      { class: `niveau n${n}` },
      donnees.objectifs
        .filter((o) => o.niveau === n)
        .map((o) =>
          bouton('objectif', o.titre, () => etat.objectif === o.id, () => (etat.objectif = etat.objectif === o.id ? null : o.id), {
            title: o.texte,
          }),
        ),
    ),
  );
  const blocObjectif = el(
    'section',
    { class: 'bloc groupe-cadrage' },
    el('div', { class: 'groupe-tete' }, el('h3', {}, donnees.cadrage.objectif.titre), el('p', { class: 'note' }, donnees.cadrage.objectif.sous)),
    el('div', { class: 'echelle' }, el('span', {}, 'Facile'), el('span', { class: 'trait' }), el('span', {}, 'Complexe')),
    el('div', { class: 'niveaux' }, niveaux),
  );

  // ---------- 2. les réciprenants ----------
  const acteurs = creerActeurs({
    cercles: donnees.cercles,
    familles: donnees.acteurs,
    roles: donnees.cadrage.roles,
    lirePlaces: () => etat.places,
    ajouter: (place) => {
      etat.places = [...etat.places, place];
      enregistrer();
    },
    modifier: (uid, valeurs) => {
      etat.places = etat.places.map((p) => (p.uid === uid ? { ...p, ...valeurs } : p));
      enregistrer();
    },
    retirer: (uid) => {
      etat.places = etat.places.filter((p) => p.uid !== uid);
      enregistrer();
    },
  });

  // ---------- 3 et 4. les deux axes, chacun sous la Boussole ----------
  const boussoles = [];
  const blocBoussole = () => {
    const zone = el('div', { class: 'boussole-zone' });
    const legende = el('div', { class: 'boussole-legende' });
    boussoles.push({ zone, legende });
    return el('section', { class: 'bloc boussole-bloc' }, el('div', { class: 'etiquette' }, 'La Boussole'), el('div', { class: 'boussole-cadre' }, zone, legende));
  };

  const axe = (cle) =>
    el(
      'section',
      { class: 'bloc axe' },
      donnees.criteres[cle].criteres.map((c) =>
        el(
          'fieldset',
          { class: 'crit' },
          el('legend', {}, c.libelle),
          el(
            'div',
            { class: 'segments' },
            NIVEAUX.map((niveau) =>
              bouton(
                'seg',
                c.niveaux[niveau],
                () => etat.reponses[c.id] === niveau,
                () => {
                  if (etat.reponses[c.id] === niveau) delete etat.reponses[c.id];
                  else etat.reponses[c.id] = niveau;
                },
              ),
            ),
          ),
        ),
      ),
    );

  // ---------- 5. signaux ----------
  const grilleSignaux = el(
    'div',
    { class: 'signaux-grille' },
    donnees.signaux.categories.map((categorie) =>
      bouton(
        'signal',
        [el('span', { class: 'cat-nom' }, categorie.nom), el('span', { class: 'exemples' }, categorie.signaux.join(' · '))],
        () => etat.signaux.includes(categorie.id),
        () => (etat.signaux = basculer(etat.signaux, categorie.id)),
        { title: categorie.signaux.join('\n') },
      ),
    ),
  );

  // ---------- pages ----------
  const { complexite, capacite } = donnees.criteres;
  const pages = {
    atterrir: el('div', { class: 'etape' }, entete(donnees.cadrage.titre, donnees.cadrage.sous), groupesCadrage, blocObjectif),
    reciprenants: el(
      'div',
      { class: 'etape' },
      entete('Entre qui et qui', 'Qui est directement concerné par cet objectif ? Qui pourrait contribuer, bénéficier ou être impacté ?'),
      acteurs.element,
    ),
    pese: el('div', { class: 'etape' }, entete(complexite.titre, complexite.sous), blocBoussole(), axe('complexite')),
    porter: el('div', { class: 'etape' }, entete(capacite.titre, capacite.sous), blocBoussole(), axe('capacite')),
    signaux: el('div', { class: 'etape' }, entete('Signaux d’alerte', 'Cochez ce qui sonne vrai.'), grilleSignaux),
  };

  const liensEtapes = ETAPES.map((e, i) =>
    el('a', { href: `#${e.id}`, class: 'etape-lien' }, el('span', { class: 'etape-num' }, String(i + 1)), e.nom),
  );
  navEtapes.replaceChildren(...liensEtapes);
  const piedEtapes = el('nav', { class: 'pied-etapes', 'aria-label': 'Étape précédente ou suivante' });
  zoneSaisie.replaceChildren(...Object.values(pages), piedEtapes);

  const router = () => {
    const courante = etapeDuHash() ?? ETAPES[0].id;
    const rang = ETAPES.findIndex((e) => e.id === courante);
    for (const [id, page] of Object.entries(pages)) page.hidden = id !== courante;
    liensEtapes.forEach((lien, i) => (i === rang ? lien.setAttribute('aria-current', 'step') : lien.removeAttribute('aria-current')));
    const precedente = ETAPES[rang - 1];
    const suivante = ETAPES[rang + 1];
    piedEtapes.replaceChildren(
      precedente ? el('a', { href: `#${precedente.id}`, class: 'pied-lien' }, `← ${precedente.nom}`) : el('span'),
      suivante ? el('a', { href: `#${suivante.id}`, class: 'pied-lien suivant' }, `${suivante.nom} →`) : el('span'),
    );
    zoneSaisie.scrollTop = 0;
  };
  window.addEventListener('hashchange', router);

  // ---------- colonne de droite : la trace ----------
  const signatures = new Map();
  let dejaRendu = false;

  const blocTrace = (cle, etape, classe, titre, ...contenu) => {
    const rang = ETAPES.findIndex((e) => e.id === etape);
    return el(
      'section',
      { class: `bloc-l ${classe}`, 'data-cle': cle },
      el('div', { class: 'entete-l' }, el('span', { class: 'etiquette' }, titre), el('a', { href: `#${etape}`, class: 'source' }, `← ${rang + 1}. ${ETAPES[rang].nom}`)),
      ...contenu,
    );
  };

  const decompte = (nom, axeLu) => {
    const { compte, repondus, total, minimum, niveau } = axeLu;
    const detail = NIVEAUX.filter((n) => compte[n]).map((n) => `${compte[n]} ${n}`).join(' · ') || 'aucune réponse';
    const reste = minimum - repondus;
    const issue = niveau ? `→ ${niveau}` : `(encore ${reste} réponse${reste > 1 ? 's' : ''} au minimum)`;
    return el('p', { class: 'decompte' }, el('span', { class: 'cat-nom' }, nom), ` ${repondus}/${total} : ${detail} ${issue}`);
  };

  const rendreLecture = (l) => {
    const croisement = donnees.positions.croisement;
    const c = etat.cadrage;
    const nomCercle = (rang) => (rang === 0 ? 'vous' : `« ${donnees.cercles[rang - 1].nom} »`);

    const cadrage = blocTrace(
      'cadrage',
      'atterrir',
      'cadre',
      'La réciprocité',
      el('p', { class: c.nom ? 'phrase' : 'phrase vide' }, c.nom || 'Sans nom pour le moment'),
      c.intention ? el('p', { class: 'texte' }, c.intention) : el('p', { class: 'attente' }, 'Intention à préciser.'),
      l.objectif
        ? el('div', { class: `cible n${l.objectif.niveau}` }, el('p', { class: 'titre' }, l.objectif.titre), el('p', { class: 'note' }, `Niveau ${l.objectif.niveau} sur 4`))
        : el('p', { class: 'attente' }, 'Ce que la réciprocité accomplira : à choisir.'),
    );

    const sansDistance = etat.places.filter((p) => !p.cercle);
    const decrire = (p) => {
      const qui = p.nom ? `${p.nom} (${titresTypes.get(p.type)})` : titresTypes.get(p.type);
      return p.roles.length ? `${qui} : ${p.roles.map((r) => titresRoles.get(r).toLowerCase()).join(', ')}` : qui;
    };
    const reciprenants = blocTrace(
      'reciprenants',
      'reciprenants',
      'reciprenants-l',
      `Entre qui et qui${etat.places.length ? ` · ${etat.places.length}` : ''}`,
      etat.places.length
        ? el(
            'ul',
            { class: 'cercles-liste' },
            l.cercles.groupes
              .filter((g) => g.places.length)
              .map((g) => el('li', {}, el('span', { class: 'cat-nom' }, g.nom), el('ul', {}, g.places.map((p) => el('li', {}, decrire(p)))))),
            sansDistance.length ? el('li', {}, el('span', { class: 'cat-nom' }, 'Distance à préciser'), el('ul', {}, sansDistance.map((p) => el('li', {}, decrire(p))))) : null,
          )
        : el('p', { class: 'attente' }, 'Aucun réciprenant pour le moment.'),
      l.cercles.sauts.map((saut) =>
        el(
          'p',
          { class: 'saut' },
          `Aucun lien entre ${nomCercle(saut.depuis)} et ${nomCercle(saut.vers)} : ces acteurs-là seront difficiles à approcher directement. Créez d'abord des liens plus près.`,
        ),
      ),
      l.cercles.sauts.length ? el('p', { class: 'note' }, 'Règle provisoire, à confirmer.') : null,
    );

    const boussole = blocTrace(
      'boussole',
      l.complexite.niveau ? 'porter' : 'pese',
      'position',
      'La Boussole',
      dessinerBoussole(l, donnees.positions, { compacte: true }),
      l.position
        ? [
            el('p', { class: 'nom' }, l.position.nom),
            el('p', { class: 'texte' }, l.position.texte),
            l.position.confirmee ? null : el('p', { class: 'note' }, "Cette case de la grille n'est pas encore confirmée."),
          ]
        : el('p', { class: 'attente' }, 'La position se lit à partir de 4 réponses sur 7 dans chaque colonne.'),
    );

    const ecart = l.ecart
      ? blocTrace(
          'ecart',
          'porter',
          `ecart ${l.ecart}`,
          'Ce que je lis',
          el('p', { class: 'verdict' }, croisement.messages[l.ecart].etiquette),
          el('p', { class: 'texte' }, croisement.messages[l.ecart].texte),
          croisement.provisoire ? el('p', { class: 'note' }, 'Règle provisoire, à confirmer.') : null,
        )
      : null;

    const demarches = l.position
      ? blocTrace('demarches', 'porter', 'demarches', 'Pour cette position', el('ul', {}, l.position.demarches.map((d) => el('li', {}, d))))
      : null;

    const alertes = l.alertes.length
      ? blocTrace(
          'alertes',
          'signaux',
          'alertes',
          `Signaux repérés - ${l.alertes.length} ${l.alertes.length > 1 ? 'catégories' : 'catégorie'}`,
          l.alertes.map((categorie) =>
            el(
              'details',
              { class: 'alerte', open: l.alertes.length <= 2 },
              el('summary', {}, el('span', { class: 'cat-nom' }, categorie.nom), el('span', { class: 'dit' }, categorie.signaux.map((s) => `« ${s} »`).join(' '))),
              categorie.alertes.map((a) =>
                el(
                  'div',
                  { class: 'ligne' },
                  el('p', { class: 'signal-nom' }, a.signal),
                  el('p', { class: 'action' }, a.action, ' ', el('span', { class: 'type', title: donnees.signaux.types[a.type] }, a.type)),
                ),
              ),
            ),
          ),
        )
      : null;

    // Écho : un bloc dont le contenu (ou le point de la Boussole) a changé s'allume brièvement.
    const blocs = [cadrage, reciprenants, boussole, ecart, demarches, alertes].filter(Boolean);
    for (const bloc of blocs) {
      const cle = bloc.dataset.cle;
      const point = bloc.querySelector('.point');
      const signature = `${bloc.textContent}|${point?.getAttribute('cx')}|${point?.getAttribute('cy')}`;
      if (dejaRendu && signatures.get(cle) !== signature) bloc.classList.add('echo');
      signatures.set(cle, signature);
    }
    for (const cle of [...signatures.keys()]) if (!blocs.some((b) => b.dataset.cle === cle)) signatures.delete(cle);
    dejaRendu = true;

    zoneLecture.replaceChildren(...blocs);
  };

  function maj() {
    pressables.forEach((f) => f());
    acteurs.maj();
    const l = lire(etat, donnees);
    for (const { zone, legende } of boussoles) {
      zone.replaceChildren(dessinerBoussole(l, donnees.positions));
      legende.replaceChildren(
        decompte(complexite.titre, l.complexite),
        decompte(capacite.titre, l.capacite),
        el(
          'p',
          { class: 'note' },
          "Règle : un niveau l'emporte quand il réunit plus de la moitié des réponses, sinon c'est « moyenne ». Il faut au moins 4 réponses sur 7 par colonne.",
        ),
      );
    }
    rendreLecture(l);
  }

  document.getElementById('effacer').addEventListener('click', () => {
    if (!window.confirm('Effacer toutes les réponses de cet écran ?')) return;
    etat = structuredClone(ETAT_VIDE);
    champs.forEach((f) => f());
    enregistrer();
  });

  router();
  maj();
}

demarrer();
