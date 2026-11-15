function selectorPanel(options, selected, command) {
  return `<div class="panel-options">${options
    .map(([value, label]) =>
      action(label, command, {
        value,
        glyph: String(value) === String(selected) ? 'check' : '',
        style: 'outline',
        attributes: `aria-pressed="${String(value) === String(selected)}"`,
      }),
    )
    .join('')}</div>`;
}

function noticePanel(title, body, extra = '') {
  return { title, body: `<p class="body-copy">${body}</p>${extra}` };
}

function detailPanel(type) {
  return {
    connexion: () =>
      noticePanel(
        'Votre compte Sprinter',
        'L’accès nécessite un compte. Cette maquette ouvre une session de démonstration.',
        action('Ouvrir la démo', 'enter-session'),
      ),
    allure: () => ({
      title: 'Allure cible',
      body: `<form id="form-pace" class="panel-form">
        <div class="form-cols">
          <label>Minutes /km<input type="number" name="minutes" min="2" max="19" required value="${Math.floor(demo.pace / 60)}" /></label>
          <label>Secondes<input type="number" name="seconds" min="0" max="59" required value="${demo.pace % 60}" /></label>
        </div>
        <label>Plage centrée sur cette allure<select name="range">
          ${[0, 5, 10, 15].map((n) => `<option value="${n}" ${demo.range === n ? 'selected' : ''}>${n ? `± ${n} s /km` : 'Allure précise'}</option>`).join('')}
        </select></label>
        <button class="action primary" type="submit">Appliquer${icon('check')}</button>
      </form>`,
    }),
    distance: () => ({
      title: 'Distance',
      body: selectorPanel(
        [
          [0, 'Distance libre'],
          [5, '5 km'],
          [10, '10 km'],
          [21.1, '21,1 km'],
        ],
        demo.distance,
        'set-distance',
      ),
    }),
    itineraire: () =>
      noticePanel(
        'Parcours',
        demo.route
          ? 'Le repère de départ est conservé. Le catalogue ne fournit pas de tracé GPS pour cet exemple.'
          : 'Vous pouvez courir librement ou choisir un repère dans Découvrir.',
        action('Ouvrir Découvrir', 'tab', { value: 'decouvrir' }) +
          (demo.route ? action('Retirer le repère', 'clear-route', { style: 'quiet', glyph: '' }) : ''),
      ),
    avances: () => ({
      title: 'Réglages avancés',
      body: `<div class="rows">
        ${row('Coach vocal', demo.voice ? 'Activé' : 'Désactivé', 'music', 'toggle-voice')}
        ${row('Chaussures', demo.shoes ? 'Paire de démonstration' : 'Sans paire', 'shoe', 'sheet', 'chaussures')}
        ${row('Position et suivi', 'Permissions, précision et auto-pause', 'pin', 'sheet', 'gps-refuse')}
      </div>`,
    }),
    'gps-refuse': () =>
      noticePanel(
        'Autorisation de localisation',
        demo.scenario === 'gps-refuse'
          ? 'Autorisez la localisation dans les réglages du téléphone pour démarrer une course GPS.'
          : 'Sprinter vérifie la localisation au démarrage. La maquette utilise des données de démonstration.',
        textButton('Revenir', 'dismiss'),
      ),
    countdown: () => ({
      title: 'Départ dans',
      body: `<p class="countdown" id="countdown-number" role="status">${demo.countdown}</p>
        ${action('Annuler le départ', 'dismiss', { glyph: '', style: 'outline' })}`,
    }),
    terminer: () =>
      noticePanel(
        'Terminer la course ?',
        'Votre sortie de démonstration apparaîtra dans l’historique après enregistrement.',
        action('Enregistrer la sortie', 'finish', { glyph: 'check' }) +
          action('Continuer la course', 'dismiss', { glyph: '', style: 'quiet' }),
      ),
    outils: () => ({
      title: 'Outils de course',
      body: `<div class="rows">
        ${demo.run?.phase === 'paused' ? row('Ouvrir l’accueil', 'Votre activité reste en pause', 'run', 'tab', 'courir') : ''}
        ${row('Objectif d’allure', `${targetLabel()} /km`, 'target', 'sheet', 'objectif')}
        ${row('Coach et annonces', demo.voice ? 'Annonces activées' : 'Annonces désactivées', 'music', 'toggle-voice')}
        ${row('Lecteur', currentPlaylist()?.name || 'Aucune playlist choisie', 'play', 'sheet', 'lecteur')}
      </div>`,
    }),
    objectif: () => noticePanel('Objectif de cette course', `${targetLabel()} /km`),
    'course-en-pause': () =>
      noticePanel(
        'Une course est en pause',
        'Terminez votre activité avant de préparer une autre sortie.',
        action('Revenir à la course', 'return-run'),
      ),
    recherche: () => ({
      title: 'Rechercher',
      body: `<label class="panel-form">Course, lieu ou club
        <input id="search-query" type="search" placeholder="Ex. Gairaut" value="${escapeMarkup(demo.search)}" autofocus /></label>
        <div id="search-results" class="results" aria-live="polite">${searchResults()}</div>`,
    }),
    favoris: () => ({
      title: 'Favoris',
      body: `<div class="results">${
        discoveryItems
          .filter(({ id }) => demo.favorites.has(id))
          .map(itemRow)
          .join('') ||
        notice('Aucun favori', 'Touchez le cœur sur une fiche pour la retrouver ici.', { glyph: 'heart' })
      }</div>`,
    }),
    filtres: () => ({
      title: 'Filtres',
      body: selectorPanel(
        [
          ['all', 'Tous les secteurs'],
          ['nice', 'Nice'],
          ['outside', 'Autour de Nice'],
          ['ten', 'Courses de 10 km'],
        ],
        demo.discoveryFilter,
        'discovery-filter',
      ),
    }),
    planning: () =>
      noticePanel(
        'Plans et objectifs',
        demo.objective
          ? `Objectif sélectionné · ${escapeMarkup(demo.objective.title)}. Le parcours natif utilise le générateur de plans adapté à la distance.`
          : 'Retrouvez les plans, les dates et vos objectifs dans le calendrier de progression.',
        row('Voir les courses', 'Choisir un objectif depuis Découvrir', 'flag', 'tab', 'decouvrir'),
      ),
    records: () =>
      noticePanel(
        'Records',
        'Vos meilleurs temps apparaissent après vérification de la qualité GPS des sorties.',
      ),
    chaussures: () =>
      noticePanel(
        'Chaussures',
        'Choisissez la paire à associer à l’activité dans cet aperçu.',
        selectorPanel(
          [
            ['0', 'Sans paire'],
            ['1', 'Paire de démonstration'],
          ],
          Number(demo.shoes),
          'select-shoes',
        ),
      ),
    comparaison: () => ({
      title: 'Comparer les sorties',
      body:
        allRuns().length < 2
          ? '<p class="body-copy">Deux sorties sont nécessaires pour une comparaison.</p>'
          : `<div class="comparison-list">${allRuns()
              .slice(0, 2)
              .map(
                (run) =>
                  `<div><strong>${escapeMarkup(run.title)}</strong><p>${distanceText(run.meters)} km · ${clockText(run.seconds)}</p></div>`,
              )
              .join('')}</div>`,
    }),
    'mes-seances': () =>
      noticePanel(
        'Mes séances',
        currentWorkout()?.name || 'Vous pourrez retrouver vos séances personnalisées et favorites ici.',
        demo.workout
          ? action('Revenir à la course libre', 'select-workout', { value: '', style: 'outline' })
          : '',
      ),
    'compte-spotify': () =>
      noticePanel(
        'Compte Spotify',
        'L’authentification et les droits de lecture sont vérifiés par l’intégration Spotify de l’application. Connexion de démonstration indisponible.',
      ),
    lecteur: () => {
      const playlist = currentPlaylist();
      return noticePanel(
        'Lecteur',
        playlist
          ? `Playlist sélectionnée · ${escapeMarkup(playlist.name)}.`
          : 'Choisissez une playlist avant votre sortie.',
        playlist?.url && demo.scenario !== 'spotify'
          ? externalLink('Ouvrir dans Spotify', playlist.url, 'primary')
          : demo.run
            ? '<p class="body-copy">La lecture est simulée dans cet aperçu.</p>'
            : action('Ouvrir la bibliothèque', 'open', { value: 'musique' }),
      );
    },
    importer: () => ({
      title: 'Importer une playlist',
      body: `<form class="panel-form" id="form-playlist">
        <p class="body-copy">Collez un lien complet Spotify. La référence reste dans la démo jusqu’à la réinitialisation.</p>
        <label>Lien de playlist<input type="text" name="playlist" placeholder="https://open.spotify.com/playlist/…" autocomplete="off" maxlength="2048" required /></label>
        <p class="form-error" id="playlist-error" role="alert" hidden>Utilisez un lien complet de playlist Spotify ou son URI.</p>
        <button class="action primary" type="submit">Importer${icon('arrow')}</button>
      </form>`,
    }),
    'editer-profil': () => ({
      title: 'Studio de profil',
      body: `<form class="panel-form" id="form-profile">
        <label>Nom affiché<input name="profileName" maxlength="36" value="${escapeMarkup(demo.profileName)}" /></label>
        <label>Bannière<select name="banner">
          ${[
            ['cote', 'Côte au crépuscule'],
            ['horizon', 'Horizon'],
            ['montagnes', 'Montagnes'],
          ]
            .map(
              ([id, label]) =>
                `<option value="${id}" ${id === demo.banner ? 'selected' : ''}>${label}</option>`,
            )
            .join('')}
        </select></label>
        ${notice('Aperçu privé', 'Les changements restent dans cette démonstration.', { glyph: 'lock' })}
        <button class="action primary" type="submit">Enregistrer${icon('check')}</button>
      </form>`,
    }),
    confidentialite: () =>
      noticePanel(
        'Confidentialité et partage',
        'Ce profil est privé. L’application vérifie l’autorisation de publication et la visibilité de chaque champ avant le partage.',
        row('Mes données', 'Export, consentements et suppression du compte', 'lock', 'sheet', 'mes-donnees'),
      ),
    'mes-donnees': () =>
      noticePanel(
        'Mes données',
        'Ces actions exigent le compte réel et une vérification d’identité. Le prototype montre leur point d’accès.',
      ),
    reglages: () => ({
      title: 'Compte et réglages',
      body: `<div class="rows">
        ${row('Compte Sprinter', 'Sécurité, données et assistance', 'user', 'sheet', 'mes-donnees')}
        ${row('Apparence', demo.dark ? 'Thème sombre' : 'Thème clair', 'layers', 'toggle-theme')}
        ${row('Préférences sportives', 'Coach, chaussures et GPS', 'filter', 'sheet', 'avances')}
        ${row('Intégrations', 'Spotify et services Apple selon l’appareil', 'music', 'sheet', 'integrations')}
      </div>`,
    }),
    integrations: () =>
      noticePanel(
        'Intégrations',
        'Apple Santé et Live Activities dépendent du binaire. Le compte Spotify possède sa propre connexion.',
        action('Bibliothèque Musique', 'open', { value: 'musique' }),
      ),
  }[type]?.();
}

function sheetContent(key) {
  const [type, id] = key.split('/');
  if (type === 'seance') {
    const plan = plans.find((item) => item.id === id);
    return noticePanel(
      plan.name,
      plan.description,
      `<p class="kicker">${escapeMarkup(plan.meta)}</p>
      ${demo.workout && demo.workout !== id ? '<p class="body-copy">Cette sélection remplace la séance actuelle.</p>' : ''}
      ${action('Choisir cette séance', 'select-workout', { value: id })}`,
    );
  }
  if (type === 'playlist') {
    const playlist = [...samples, ...demo.imported].find((item) => item.id === id);
    return {
      title: playlist.name,
      body: `<p class="body-copy">${escapeMarkup(playlist.meta)}</p>
        ${playlist.tracks.length ? `<ol class="tracks">${playlist.tracks.map((track) => `<li>${escapeMarkup(track)}</li>`).join('')}</ol>` : ''}
        ${action(playlist.id === demo.playlist ? 'Retirer de la sortie' : 'Choisir pour la sortie', 'select-playlist', { value: playlist.id })}`,
    };
  }
  return detailPanel(type);
}

function searchResults() {
  const normalize = (text) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr-FR');
  const query = normalize(demo.search.trim());
  const matches = discoveryItems.filter((item) => normalize(`${item.title} ${item.city}`).includes(query));
  return (
    (query ? matches : discoveryItems.slice(0, 4)).map(itemRow).join('') ||
    '<p class="body-copy">Aucune fiche trouvée.</p>'
  );
}
