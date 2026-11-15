const plans = [
  {
    id: 'intervals',
    kind: 'Fractionné',
    name: 'Fractionné 10 × 400 m',
    meta: '10 efforts · récupération 1 min 30',
    icon: 'zap',
    description:
      'Alternez 400 m d’effort et 90 s de récupération. Ajustez l’échauffement et la plage d’allure dans l’éditeur de séance.',
  },
  {
    id: 'endurance',
    kind: 'Endurance',
    name: 'Endurance régulière',
    meta: '30 min · allure stable',
    icon: 'clock',
    description: 'Courez trente minutes dans une plage d’allure confortable et configurable.',
  },
  {
    id: 'progressive',
    kind: 'Tempo',
    name: 'Accélération progressive',
    meta: '5 km · 5 paliers',
    icon: 'chart',
    description: 'La cible change à chaque kilomètre. Retrouvez vos moyennes par palier après la séance.',
  },
  {
    id: 'survival',
    kind: 'Défis',
    name: 'Survie 5 km',
    meta: '5 km · budget hors cible',
    icon: 'flag',
    description:
      'Gardez votre allure pendant 5 km. Le défi se termine si le budget de temps hors cible est épuisé.',
  },
];

const samples = [
  {
    id: 'morning',
    name: 'Morning Miles',
    meta: '3 titres d’exemple',
    image: 'coureuse',
    tracks: ['Première lumière', 'Plein air', 'Retour au calme'],
  },
  {
    id: 'long',
    name: 'Long Run',
    meta: '3 titres d’exemple',
    image: 'montagnes',
    tracks: ['La montée', 'Sur le fil', 'Au loin'],
  },
  {
    id: 'tempo',
    name: 'Pace Set',
    meta: '3 titres d’exemple',
    image: 'affichePiste',
    tracks: ['Échauffement', '400 mètres', 'Dernier tour'],
  },
];

const featured = discoveryItems.find((item) => item.id === 'prom-classic-2027');
const featuredRoute = discoveryItems.find((item) => item.id === 'canal-gairaut');
const currentWorkout = () => plans.find((item) => item.id === demo.workout);
const currentPlaylist = () => [...samples, ...demo.imported].find((item) => item.id === demo.playlist);
const allRuns = () => [...(demo.saved ? [demo.saved] : []), ...(demo.scenario === 'vide' ? [] : demoRuns)];
const safeDate = (day) => datesInParis.format(new Date(Date.UTC(2026, 10, day, 12)));
const layout = (main, footer = '', tone = '') => ({ main, footer, tone });
const withTabs = (main, id) => layout(main, pausedReturn() + tabBar(id));
const fixed = (contents) => `<div class="fixed-actions">${contents}</div>`;
const pausedReturn = () =>
  demo.run?.phase === 'paused'
    ? `<div class="pause-return">${action('Revenir à la course en pause', 'return-run', { glyph: 'arrow' })}</div>`
    : '';

function welcomeView() {
  return layout(
    `<section class="welcome">
    ${photo(demo.scenario === 'media' ? 'horizon' : 'aube', { position: '49% 52%', decorative: true })}
    <header>${brand()}</header>
    <div class="welcome-copy">
      <h1 tabindex="-1">Courir.<br />Respirer.<br />Recommencer.</h1>
      <p>Connectez-vous ou créez un compte pour accéder à Sprinter.</p>
      ${action('Continuer', 'sheet', { value: 'connexion' })}
    </div>
  </section>`,
    '',
    'cinema',
  );
}

function runHomeView() {
  const paused = demo.run?.phase === 'paused';
  const readyLabel = paused
    ? 'Revenir à la course'
    : demo.scenario === 'recuperation'
      ? 'Reprendre ma sortie'
      : 'Démarrer';
  const runningTitle = demo.direction === 'c' ? 'Courir.' : 'À votre\nallure.';
  const visual = demo.direction === 'c' ? 'piste' : 'rive';
  const workout = currentWorkout();
  const playlist = currentPlaylist();
  const main = `${appHeader('Courir', {
    branded: true,
    trailing: iconButton('music', 'Ouvrir la bibliothèque Musique', 'open', 'musique'),
  })}
    <section class="home-hero editorial-hero">
      ${photo(visual, { position: visual === 'rive' ? '71% 52%' : '52% 53%', unavailable: demo.scenario === 'media' })}
      <div class="hero-copy">
        <p class="kicker">${escapeMarkup(workout?.name || 'Course libre')}</p>
        <h1 tabindex="-1">${runningTitle}</h1>
      </div>
    </section>
    ${
      paused
        ? `<div class="page-pad home-recovery">${notice('Course en pause', 'Reprenez ou terminez votre activité depuis l’écran de course.', { glyph: 'pause' })}</div>`
        : demo.scenario === 'recuperation'
          ? `<div class="page-pad home-recovery">${notice('Sortie à récupérer', 'Votre dernière sortie s’est interrompue. Elle reprendra en pause.', { glyph: 'clock' })}</div>`
          : `<section class="home-plan page-pad">
          <div class="home-target"><span class="kicker">Allure cible</span>
            <strong>${escapeMarkup(targetLabel())}<small> /km</small></strong></div>
          ${action('Préparer', 'open', { value: 'preparation', style: 'outline', glyph: 'filter' })}
        </section>
        <div class="page-pad home-secondary">${row('Séances', '', 'layers', 'open', 'seances')}</div>`
    }
  `;
  const mini =
    playlist && !paused
      ? `<div class="mini-player">
    <button type="button" data-action="sheet" data-value="lecteur" aria-label="Ouvrir le lecteur · ${escapeMarkup(playlist.name)}">${icon('music')}
      <span><strong>${escapeMarkup(playlist.name)}</strong><small>Playlist pour la sortie</small></span>${icon('next')}
    </button>
  </div>`
      : '';
  return layout(
    main,
    fixed(
      action(readyLabel, paused ? 'return-run' : 'start', {
        glyph: paused || demo.scenario === 'recuperation' ? 'arrow' : 'play',
      }),
    ) +
      mini +
      tabBar('courir'),
  );
}

function preparationView() {
  const workout = currentWorkout();
  const playlist = currentPlaylist();
  const fromEvent = demo.objective;
  return layout(
    `
    ${appHeader('Préparer', { back: true })}
    <div class="page-pad page-stack prep-layout">
      ${
        fromEvent
          ? notice('Objectif Découvrir', fromEvent.title, {
              glyph: 'flag',
              extra: textButton('Plans et objectifs', 'sheet', 'planning'),
            })
          : ''
      }
      <section class="pace-card">
        <div><p class="kicker">Allure cible</p>
          <p class="pace-preview">${escapeMarkup(targetLabel())} <small>/km</small></p>
          <p>${demo.range ? 'Plage d’allure' : 'Allure précise'}</p></div>
        ${action('Modifier', 'sheet', { value: 'allure', glyph: '', style: 'inverse-outline' })}
      </section>
      <div class="rows">
        ${row('Distance', demo.distance ? `${displayNumber.format(demo.distance)} km` : 'Libre', 'flag', 'sheet', 'distance')}
        ${row('Séance', workout?.name || 'Course libre', 'layers', 'open', 'seances')}
        ${row('Musique', playlist?.name || 'Aucune playlist', 'music', 'open', 'musique')}
        ${row('Parcours', demo.route?.title || 'Sans itinéraire', 'route', 'sheet', 'itineraire')}
      </div>
      ${row('Réglages avancés', 'Coach, chaussures et GPS', 'filter', 'sheet', 'avances')}
    </div>`,
    fixed(`
      ${demo.scenario === 'gps-refuse' ? '<p class="footer-note">Autorisation GPS requise</p>' : ''}
      ${action('Démarrer', 'start', { glyph: 'play' })}`),
  );
}

function liveView() {
  const run = demo.run;
  const phase = run.phase;
  const paused = phase !== 'running';
  const saving = phase === 'saving';
  const weak = demo.scenario === 'gps-faible';
  const visiblePace = run.meters > 0 && !weak;
  const gps = weak ? 'GPS imprécis' : run.meters ? 'GPS stable' : 'GPS en attente';
  const inZone = run.pace >= demo.pace - (demo.range || 8) && run.pace <= demo.pace + (demo.range || 8);
  const zone = inZone ? 'on' : run.pace < demo.pace ? 'fast' : 'slow';
  const zoneLabel = { on: 'Dans la cible', fast: 'Trop rapide', slow: 'Trop lent' }[zone];
  const phaseLabel = phase === 'auto' ? 'Pause automatique' : paused ? 'En pause' : 'Course en cours';
  const livePace = visiblePace ? paceText(run.pace) : '—';
  return layout(
    `
    <header class="live-header">
      <div><p class="live-status ${paused ? 'paused' : ''}"><span></span>${phaseLabel}</p>
        <h1 tabindex="-1">${escapeMarkup(currentWorkout()?.name || 'Course libre')}</h1></div>
      ${iconButton('more', 'Outils de course', 'sheet', 'outils')}
    </header>
    <div class="page-pad live-layout">
      <section class="live-instrument">
        <p class="kicker">Allure actuelle</p>
        <p class="live-pace">${livePace}<small> /km</small></p>
        ${
          visiblePace
            ? `<div class="zone-ruler" data-zone="${zone}" aria-hidden="true"><span></span></div>
          <p class="zone-label ${zone}">${icon(zone === 'on' ? 'check' : 'alert')} ${zoneLabel}</p>`
            : '<p class="zone-label">Allure indisponible</p>'
        }
      </section>
      <dl class="paired-metrics">
        ${metric('Distance', distanceText(run.meters), 'km')}
        <div class="metric"><dt>Temps actif</dt><dd id="run-time">${clockText(elapsedRun())}</dd></div>
      </dl>
      <section class="live-track">
        <div class="track-bar"><span class="${weak ? 'weak' : ''}">${icon(weak ? 'alert' : 'pin')} ${gps}</span>
          ${textButton(run.showTrack ? 'Masquer le tracé' : 'Voir le tracé', 'toggle-track', '', `aria-expanded="${run.showTrack}"`)}</div>
        ${run.showTrack ? trace(run.track) : ''}
      </section>
      ${phase === 'auto' ? notice('Temps actif suspendu', 'Le suivi reprend dès qu’un mouvement est confirmé.', { glyph: 'clock' }) : ''}
      ${demo.saveError ? notice('Échec d’enregistrement', 'La sortie reste en pause. Vous pouvez réessayer.', { tone: 'danger' }) : ''}
    </div>`,
    fixed(
      saving
        ? '<p role="status" class="save-pending">Enregistrement…</p>'
        : `
      ${action(
        phase === 'running' ? 'Mettre en pause' : phase === 'auto' ? 'Passer en pause manuelle' : 'Reprendre',
        'pause',
        { glyph: phase === 'paused' ? 'play' : 'pause', style: 'primary live-action' },
      )}
      ${action(demo.saveError ? 'Réessayer l’enregistrement' : 'Terminer', 'sheet', {
        value: 'terminer',
        glyph: 'stop',
        style: 'quiet live-finish',
        attributes: 'id="hold-finish"',
      })}`,
    ),
    'instrument',
  );
}

function runReportView(route, summary) {
  const run = summary
    ? demo.saved || demoRuns[0]
    : allRuns().find((item) => item.id === route.value) ||
      demoRuns.find((item) => item.id === route.value) ||
      demoRuns[0];
  const average = run.meters > 0 && run.seconds > 0 ? Math.round((run.seconds / run.meters) * 1000) : 0;
  return layout(
    `${appHeader(summary ? 'Bilan de sortie' : run.title, {
      back: !summary,
      eyebrow: summary ? 'Sortie enregistrée' : safeDate(run.day),
    })}
    <div class="page-pad page-stack report">
      <section class="report-cover">
        ${trace(run.track)}
        <p class="cover-caption">${run.track?.length ? 'Tracé de démonstration' : 'Sortie sans trace GPS'}</p>
      </section>
      <dl class="three-metrics">
        ${metric('Distance', distanceText(run.meters), 'km')}${metric('Temps actif', clockText(run.seconds))}
        ${metric('Allure moy.', paceText(average), '/km')}
      </dl>
      ${
        summary
          ? row('Retrouver dans l’historique', '', 'clock', 'open', 'historique')
          : `
        ${row('Comparer cette sortie', 'Comparer les métriques avec une autre activité', 'chart', 'sheet', 'comparaison')}
        ${row('Exporter le GPX', run.track?.length ? 'Fichier de démonstration' : 'Aucun tracé à exporter', 'down', 'gpx', run.id)}`
      }
    </div>`,
    fixed(
      summary
        ? `
      ${action('Voir le détail', 'open', { value: `activite/${run.id}` })}
      ${textButton('Retour à Courir', 'tab', 'courir')}`
        : '',
    ),
  );
}

function workoutView() {
  const filter = demo.workoutFilter;
  return layout(`${appHeader('Séances', { back: true })}
    <div class="page-pad page-stack workouts">
      <div class="chip-group" aria-label="Types de séance">
        ${['Tout', 'Endurance', 'Fractionné', 'Tempo', 'Défis'].map((kind) => chipButton(kind, 'workout-filter', kind, filter === kind)).join('')}
      </div>
      ${
        filter === 'Tout' || filter === 'Fractionné'
          ? `
        <button type="button" class="editorial-hero training-hero" data-action="sheet" data-value="seance/intervals">
          ${photo('piste', { position: '50% 70%', unavailable: demo.scenario === 'media' })}
          <span class="hero-copy"><span class="kicker">Fractionné</span><strong>10 × 400 m</strong><span>90 s de récupération ${icon('arrow')}</span></span>
        </button>`
          : ''
      }
      ${sectionHeader(filter === 'Tout' ? 'Bibliothèque' : filter)}
      <div class="rows">${(filter === 'Tout'
        ? plans.slice(1)
        : plans.filter((item) => item.kind === filter && item.id !== 'intervals')
      )
        .map((item) => row(item.name, item.meta, item.icon, 'sheet', `seance/${item.id}`))
        .join('')}
        ${filter === 'Tout' ? row('Mes séances', 'Personnalisées et favorites', 'heart', 'sheet', 'mes-seances') : ''}
      </div>
    </div>`);
}

function itemRoute(item) {
  return { race: 'evenement', route: 'parcours', club: 'club', place: 'lieu' }[item.kind] + '/' + item.id;
}

const kindTitle = { race: 'Course', route: 'Parcours', club: 'Club', place: 'Lieu' };

function itemMeta(item) {
  const date = item.schedule?.startAt;
  const distance = item.distancesKm?.[0];
  return [
    date ? datesInParis.format(new Date(date)) : '',
    item.city,
    distance ? `${displayNumber.format(distance)} km` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function itemRow(item) {
  const artwork = item.mediaKey || (item.kind === 'club' ? 'coureuse' : 'affichePiste');
  return `<button type="button" class="result-row" data-action="open" data-value="${itemRoute(item)}">
    <span class="result-thumb">${photo(artwork, { decorative: true, unavailable: demo.scenario === 'media' })}</span>
    <span class="row-copy"><strong>${escapeMarkup(item.title)}</strong><small>${escapeMarkup(itemMeta(item))}</small></span>${icon('next')}
  </button>`;
}

function discoveryView() {
  const filtered =
    demo.category === 'all'
      ? discoveryItems.filter((item) => item.id !== featured.id)
      : discoveryItems.filter((item) => item.kind === demo.category);
  const categories = [
    ['all', 'Tout'],
    ['race', 'Courses'],
    ['club', 'Clubs'],
    ['route', 'Parcours'],
    ['place', 'Lieux'],
  ];
  const isOverview = demo.category === 'all';
  const stalled = demo.scenario === 'erreur' && !demo.catalogRecovered;
  const loading = demo.scenario === 'chargement' && !demo.catalogRecovered;
  const coverKey = demo.direction === 'b' ? 'villefranche' : 'promenade';
  const imageKey = demo.direction === 'b' && isOverview ? coverKey : featured.mediaKey;
  return withTabs(
    `${appHeader('Découvrir', {
      eyebrow: 'Nice · Côte d’Azur',
      trailing: `<div class="header-tools">${iconButton('search', 'Rechercher', 'sheet', 'recherche')}
      ${iconButton('heart', 'Voir les favoris', 'sheet', 'favoris')}</div>`,
    })}
    <div class="page-pad discovery-layout page-stack">
      ${demo.scenario === 'offline' ? notice('Hors ligne', 'Catalogue enregistré le 15 novembre 2026.', { glyph: 'clock' }) : ''}
      ${
        loading
          ? `<section class="catalogue-loading">
        <div class="loading-cover" aria-hidden="true"></div>
        <p role="status">Chargement du catalogue…</p>
        ${textButton('Afficher le résultat simulé', 'retry-catalogue')}
      </section>`
          : stalled
            ? notice('Catalogue indisponible', 'La dernière réponse n’a pas pu être chargée.', {
                extra: textButton('Réessayer', 'retry-catalogue'),
              })
            : `
        ${
          isOverview
            ? `<button class="editorial-hero discovery-hero" type="button" data-action="open" data-value="${itemRoute(featured)}"
          data-photo-key="${imageKey === featured.mediaKey && demo.scenario !== 'media' ? featured.id : ''}">
          ${photo(imageKey, { position: '53% 58%', unavailable: demo.scenario === 'media' })}
          <span class="hero-copy">
            <span class="kicker">${demo.direction === 'b' ? 'Agenda Côte d’Azur' : 'Course à la une'}</span>
            <strong>${escapeMarkup(featured.title)}</strong>
            <span class="hero-meta">${escapeMarkup(itemMeta(featured))}${icon('arrow')}</span>
          </span>
        </button>
        ${demo.direction === 'b' ? '<p class="cover-credit">Rade de Villefranche-sur-Mer · JChevall</p>' : ''}`
            : ''
        }
        <section class="discover-browse">
          ${sectionHeader(
            isOverview ? 'À explorer' : categories.find(([key]) => key === demo.category)[1],
            `<span class="browse-tools">${iconButton('filter', 'Filtres de découverte', 'sheet', 'filtres')}
              ${textButton('Carte', 'open', 'carte')}</span>`,
          )}
          <div class="chip-group" aria-label="Catégories de Découvrir">
            ${categories.map(([key, label]) => chipButton(label, 'category', key, demo.category === key)).join('')}
          </div>
          <div class="results">
            ${
              filtered
                .filter(matchesDiscoveryFilter)
                .slice(0, isOverview ? 4 : filtered.length)
                .map(itemRow)
                .join('') ||
              notice('Aucun résultat', 'Essayez un autre filtre.', {
                glyph: 'search',
                extra: textButton('Effacer le filtre', 'clear-filter'),
              })
            }
          </div>
        </section>`
      }
    </div>`,
    'decouvrir',
  );
}

const photoCredit = {
  promenade: [
    'Photo de la Promenade · Uhooep · CC BY-SA 4.0',
    'https://commons.wikimedia.org/wiki/File:Promenade_des_Anglais_(Nice),_France.jpg',
  ],
  gairaut: [
    'Photo de la cascade · Kheper · CC BY-SA 3.0',
    'https://commons.wikimedia.org/wiki/File:Cascade_de_Gairaut_vue_d%27ensemble.jpg',
  ],
  villefranche: [
    'Photo de la rade · JChevall · CC BY-SA 4.0',
    'https://commons.wikimedia.org/wiki/File:Vue_g%C3%A9n%C3%A9rale_de_Villefranche_sur_Mer.jpg',
  ],
  vence: ['Photo de Vence · Myrabella · CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Vence.jpg'],
};

function discoveryDetailView(route) {
  const item =
    discoveryItems.find((candidate) => candidate.id === route.value) ||
    {
      parcours: featuredRoute,
      evenement: featured,
      club: discoveryItems.find(({ kind }) => kind === 'club'),
      lieu: discoveryItems.find(({ kind }) => kind === 'place'),
    }[route.id];
  const isRace = item.kind === 'race';
  const start = item.schedule?.startAt ? new Date(item.schedule.startAt) : null;
  const saved = demo.favorites.has(item.id);
  const credit = demo.scenario !== 'media' ? photoCredit[item.mediaKey] : undefined;
  const distance =
    item.id === featuredRoute.id
      ? '1,75 km annoncés'
      : item.distancesKm?.map((km) => `${displayNumber.format(km)} km`).join(' / ');
  const registration = item.registration?.state === 'sold_out' ? 'Complet lors du relevé' : '';
  return layout(
    `
    <div class="detail-cover editorial-hero" data-photo-key="${credit ? item.id : ''}">
      ${photo(item.mediaKey, { position: item.id === featuredRoute.id ? '50% 44%' : '51% 57%', unavailable: demo.scenario === 'media' })}
      <div class="cover-actions">${iconButton('back', 'Retour', 'back')}
        ${iconButton('heart', saved ? 'Retirer le favori' : 'Enregistrer en favori', 'favorite', item.id, `aria-pressed="${saved}"`)}
      </div>
    </div>
    <div class="page-pad page-stack detail-layout">
      <header class="detail-heading">
        <p class="kicker">${kindTitle[item.kind]} <span aria-hidden="true">·</span> ${escapeMarkup(item.city)}</p>
        <h1 tabindex="-1">${escapeMarkup(item.title)}</h1>
      </header>
      ${start && isRace ? `<div class="fact-line">${icon('calendar')}<span>${eventDate.format(start)} · ${eventTime.format(start)}, heure de Paris</span></div>` : ''}
      ${
        distance || registration
          ? `<div class="detail-facts">
        ${distance ? `<span>${icon('flag')} ${escapeMarkup(distance)}</span>` : ''}
        ${registration ? `<span class="registration">${escapeMarkup(registration)}</span>` : ''}
      </div>`
          : ''
      }
      <p class="body-copy">${escapeMarkup(item.summary)}</p>
      ${item.kind === 'route' ? notice('Accès au départ', 'Le catalogue fournit un repère. La fiche officielle indique l’accès au sentier.', { glyph: 'pin' }) : ''}
      <div class="source-lines">
        <a href="${escapeMarkup(item.source.url)}" target="_blank" rel="noopener noreferrer">Source · ${escapeMarkup(item.source.name)} ↗</a>
        <small>Vérifiée le 15 novembre 2026 · Instantané de démonstration</small>
        ${credit ? `<a href="${escapeMarkup(credit[1])}" target="_blank" rel="noopener noreferrer">${escapeMarkup(credit[0])} ↗</a>` : '<small>Illustration d’ambiance</small>'}
      </div>
      ${item.point ? row('Voir le départ sur la carte', '', 'map', 'open', `carte/${item.id}`) : ''}
      ${start && isRace ? row('Exporter au calendrier', 'Heure et date de la source', 'calendar', 'ics', item.id) : ''}
    </div>`,
    fixed(
      isRace
        ? `${externalLink('Site officiel', item.officialUrl, 'primary')}
      ${textButton('Préparer cette épreuve', 'from-discovery', item.id)}`
        : `${item.kind === 'route' ? action('Préparer une sortie', 'from-discovery', { value: item.id }) : ''}
        ${externalLink(item.kind === 'route' ? 'Accès officiel' : 'Site officiel', item.officialUrl, item.kind === 'route' ? 'quiet' : 'primary')}`,
    ),
  );
}

function mapView(route) {
  const { bounds, paths } = niceMap;
  const items = discoveryItems.filter(
    ({ point }) =>
      point &&
      point.latitude >= bounds.south &&
      point.latitude <= bounds.north &&
      point.longitude >= bounds.west &&
      point.longitude <= bounds.east,
  );
  const selected = items.find((item) => item.id === (demo.pin || route.value));
  const pins = items.filter(
    (item, index) =>
      items.findIndex(
        ({ point }) => point.latitude === item.point.latitude && point.longitude === item.point.longitude,
      ) === index,
  );
  return layout(`${appHeader('Carte', { back: true, eyebrow: 'Nice · Côte d’Azur' })}
    <div class="page-pad page-stack">
      <figure class="catalogue-map">
        <svg viewBox="0 0 350 275" role="img" aria-label="Contours administratifs et repères de Découvrir" preserveAspectRatio="none">
          ${paths.map((path) => `<polyline points="${path}"/>`).join('')}
        </svg>
        ${pins
          .map(({ id, point, title }) => {
            const x = ((point.longitude - bounds.west) / (bounds.east - bounds.west)) * 100;
            const y = ((bounds.north - point.latitude) / (bounds.north - bounds.south)) * 100;
            return `<button type="button" class="map-pin" aria-label="${escapeMarkup(title)}" aria-pressed="${selected?.id === id}"
            data-action="pin" data-value="${id}" style="--x:${x}%;--y:${y}%">${icon('pin')}</button>`;
          })
          .join('')}
        <figcaption>Contours IGN · Licence Ouverte 2.0</figcaption>
      </figure>
      ${sectionHeader(selected ? 'Repère sélectionné' : 'Autour de Nice')}
      <div class="results">${(selected ? [selected] : items).map(itemRow).join('')}</div>
      ${selected ? textButton('Voir tous les repères', 'pin') : ''}
    </div>`);
}

const periods = [
  ['week', 'Semaine'],
  ['month', 'Mois'],
  ['year', 'Année'],
];
const periodLabel = { week: 'Cette semaine', month: 'Ce mois-ci', year: 'Cette année' };
const periodGroups = {
  week: [
    ['Lun.', 9, 9],
    ['Mar.', 10, 10],
    ['Mer.', 11, 11],
    ['Jeu.', 12, 12],
    ['Ven.', 13, 13],
    ['Sam.', 14, 14],
    ['Dim.', 15, 15],
  ],
  month: [
    ['1–7', 1, 7],
    ['8–14', 8, 14],
    ['15–21', 15, 21],
    ['22–30', 22, 30],
  ],
  year: [
    ['Jan.–mars', 0, 0],
    ['Avr.–juin', 0, 0],
    ['Juil.–sept.', 0, 0],
    ['Oct.–déc.', 1, 30],
  ],
};

function activityBars(runs) {
  const groups = periodGroups[demo.period].map(([label, start, end]) => [
    label,
    runs.filter(({ day }) => day >= start && day <= end).reduce((total, item) => total + item.meters, 0),
  ]);
  const max = Math.max(1, ...groups.map(([, meters]) => meters));
  return `<div class="bar-chart" aria-label="Distances par période">
    ${groups
      .map(
        ([label, meters]) => `<div class="bar-column"><span aria-hidden="true" class="bar-track">
      <span style="--bar:${Math.round((meters / max) * 100)}%" class="${meters ? 'filled' : ''}"></span>
    </span><span aria-hidden="true">${label}</span><span class="sr-only">${label} ${distanceText(meters)} km</span></div>`,
      )
      .join('')}
  </div>`;
}

function activityRow(run, { compact = false } = {}) {
  return `<button class="activity-card ${compact ? 'compact' : ''}" type="button" data-action="open" data-value="activite/${run.id}">
    ${trace(run.track)}
    <span class="activity-copy"><span class="kicker">${safeDate(run.day)}</span><strong>${escapeMarkup(run.title)}</strong>
      <small>${distanceText(run.meters)} km · ${clockText(run.seconds)}</small></span>
    <span class="activity-arrow">${icon('next')}</span>
  </button>`;
}

function progressView() {
  const runs = allRuns();
  const total = runs.reduce((meters, run) => meters + run.meters, 0);
  return withTabs(
    `${appHeader('Progrès', { trailing: iconButton('clock', 'Voir l’historique', 'open', 'historique') })}
    <div class="page-pad page-stack progress-layout">
      <div class="chip-group" aria-label="Période">${periods.map(([key, label]) => chipButton(label, 'period', key, demo.period === key)).join('')}</div>
      ${
        runs.length
          ? `<section class="progress-board">
        <div class="progress-total"><div><p class="kicker">${periodLabel[demo.period]}</p><p class="big-number">${distanceText(total)} <small>km</small></p></div>
          <span>${runs.length} sortie${runs.length === 1 ? '' : 's'}</span></div>
        ${activityBars(runs)}
      </section>
      <section class="page-stack compact-stack">
        ${sectionHeader('Dernière sortie', textButton('Historique', 'open', 'historique'))}
        ${activityRow(runs[0], { compact: true })}
      </section>`
          : `<section class="empty-view">
        <span class="empty-icon">${icon('run')}</span><h2>À la première sortie</h2>
        <p>Vos sorties enregistrées, vos distances et vos records apparaîtront ici.</p>
        ${action('Aller à Courir', 'tab', { value: 'courir' })}
        ${textButton('Voir une activité d’exemple', 'open', `activite/${demoRuns[0].id}`)}
      </section>`
      }
      <div class="rows">
        ${row('Plans et objectifs', 'Calendrier, plans et objectifs', 'flag', 'sheet', 'planning')}
        ${row('Records', 'Meilleurs temps vérifiés', 'target', 'sheet', 'records')}
        ${row('Chaussures', 'Paires et kilométrage', 'shoe', 'sheet', 'chaussures')}
      </div>
    </div>`,
    'progres',
  );
}

function historyView() {
  const filters = [
    ['all', 'Toutes'],
    ['trace', 'Avec tracé'],
  ];
  const runs = allRuns().filter((item) => demo.historyFilter === 'all' || item.track?.length);
  return layout(`${appHeader('Historique', { back: true, subtitle: 'Vos sorties' })}
    <div class="page-pad page-stack history-layout">
      <div class="chip-group" aria-label="Filtrer les sorties">
        ${filters.map(([key, label]) => chipButton(label, 'history-filter', key, demo.historyFilter === key)).join('')}
      </div>
      ${
        runs.length
          ? runs.map((run) => activityRow(run)).join('')
          : notice(
              'Aucune sortie dans cette vue',
              'Une activité s’affichera après l’enregistrement de votre sortie.',
              {
                glyph: 'clock',
                extra: textButton('Voir un exemple', 'open', `activite/${demoRuns[0].id}`),
              },
            )
      }
      ${runs.length ? row('Comparer deux sorties', 'Distance, temps et allure', 'chart', 'sheet', 'comparaison') : ''}
    </div>`);
}

function musicView() {
  const playlist = currentPlaylist();
  const empty = demo.scenario === 'vide' && !demo.imported.length;
  const unavailable = demo.scenario === 'spotify';
  return layout(`${appHeader('Musique', {
    back: true,
    eyebrow: 'Spotify',
    trailing: iconButton('user', 'Compte Spotify', 'sheet', 'compte-spotify'),
  })}
    <div class="page-pad page-stack music-layout">
      ${unavailable ? notice('Spotify indisponible', 'Vos références restent visibles. Connexion et lecture sont momentanément indisponibles.') : ''}
      ${
        !empty
          ? `<section class="music-feature">
        <div><p class="kicker">${playlist ? 'Playlist pour la sortie' : 'À écouter'}</p>
          <h2>${escapeMarkup(playlist?.name || samples[0].name)}</h2>
          ${textButton(
            playlist ? 'Ouvrir le lecteur' : 'Voir la playlist',
            'sheet',
            playlist ? 'lecteur' : 'playlist/morning',
          )}</div>
        ${photo(playlist?.image || 'coureuse', { decorative: true })}
      </section>
      ${sectionHeader('Ma bibliothèque', textButton('Importer', 'sheet', 'importer'))}
      <div class="rows">${[...demo.imported, ...samples]
        .map(
          (item) => `<button class="result-row" type="button"
        data-action="sheet" data-value="playlist/${item.id}">
        <span class="result-thumb">${photo(item.image, { decorative: true })}</span>
        <span class="row-copy"><strong>${escapeMarkup(item.name)}</strong><small>${escapeMarkup(item.meta)}</small></span>
        ${icon(item.id === demo.playlist ? 'check' : 'next')}
      </button>`,
        )
        .join('')}</div>`
          : `<section class="empty-view"><span class="empty-icon">${icon('music')}</span>
      <h2>Aucune playlist enregistrée</h2><p>Importez un lien Spotify pour retrouver votre playlist avant le départ.</p>
      ${action('Importer un lien Spotify', 'sheet', { value: 'importer', glyph: 'plus' })}</section>`
      }
    </div>`);
}

function profileView() {
  const name = demo.profileName;
  const runs = allRuns();
  const total = runs.reduce((meters, run) => meters + run.meters, 0);
  return withTabs(
    `
    <header class="profile-cover">
      ${photo(demo.banner || 'cote', { decorative: true, unavailable: demo.scenario === 'media' })}
      <div class="cover-actions"><span class="kicker">Mon espace</span>${iconButton('filter', 'Réglages et compte', 'sheet', 'reglages')}</div>
    </header>
    <div class="page-pad page-stack profile-layout">
      <div class="profile-avatar" aria-hidden="true">${escapeMarkup((name || 'S').slice(0, 1).toLocaleUpperCase('fr-FR'))}</div>
      <div class="profile-name"><div>
        <h1 tabindex="-1">${escapeMarkup(name || 'Mon profil')}</h1>
        <p>${icon('lock')} Profil privé</p>
      </div>${textButton('Modifier', 'sheet', 'editer-profil')}</div>
      ${
        runs.length
          ? `<dl class="paired-metrics profile-metrics">${metric('Distance', distanceText(total), 'km')}${metric('Sorties', String(runs.length))}</dl>`
          : '<p class="body-copy">Personnalisez votre espace. Vos sorties apparaîtront après la première activité.</p>'
      }
      <div class="rows">
        ${row('Studio de profil', 'Bannière, avatar et apparence', 'layers', 'sheet', 'editer-profil')}
        ${row('Confidentialité et partage', 'Visibilité publique et données', 'lock', 'sheet', 'confidentialite')}
        ${row('Compte et réglages', 'Connexion, préférences et intégrations', 'filter', 'sheet', 'reglages')}
      </div>
    </div>`,
    'profil',
  );
}

const views = {
  courir: runHomeView,
  bienvenue: welcomeView,
  preparation: preparationView,
  course: liveView,
  bilan: (route) => runReportView(route, true),
  decouvrir: discoveryView,
  parcours: discoveryDetailView,
  evenement: discoveryDetailView,
  club: discoveryDetailView,
  lieu: discoveryDetailView,
  carte: mapView,
  progres: progressView,
  seances: workoutView,
  historique: historyView,
  activite: (route) => runReportView(route, false),
  musique: musicView,
  profil: profileView,
};

const reviewNotes = {
  courir: [
    'Courir',
    'L’allure cible et le départ restent visibles. La bibliothèque Musique garde son accès en haut, même sans playlist.',
  ],
  bienvenue: [
    'Bienvenue',
    'La photographie ouvre le parcours. Le compte Sprinter reste obligatoire et sa condition est annoncée avant l’étape de connexion.',
  ],
  preparation: [
    'Préparer',
    'Chaque ligne résume sa valeur. Les choix courts s’ouvrent en feuille et le bouton de départ reste en bas.',
  ],
  course: [
    'Course en direct',
    'Le contraste, l’allure et la pause prennent la priorité. Essayez la pause et la confirmation de fin.',
  ],
  bilan: [
    'Bilan de sortie',
    'Le bilan apparaît après l’enregistrement simulé. Le tracé vient d’un exemple ou laisse place à un état vide.',
  ],
  decouvrir: [
    'Découvrir',
    'Comparez A, B et C sur ce même catalogue. Les catégories, la carte et la recherche restent accessibles.',
  ],
  parcours: [
    'Fiche parcours',
    'La carte montre le départ documenté. Le choix « Préparer » transmet le repère et laisse l’itinéraire GPS vide.',
  ],
  evenement: [
    'Fiche événement',
    'La date, le fuseau et l’état issu de la source précèdent le lien officiel. La préparation est accessible depuis la fiche.',
  ],
  progres: [
    'Progrès',
    'La distance et la régularité donnent une vue d’ensemble. Le scénario « Nouveau compte » montre le démarrage sans historique.',
  ],
  seances: ['Séances', 'Ouvrez la séance vedette puis choisissez-la pour revenir à la préparation.'],
  historique: [
    'Historique',
    'Les sorties ont chacune un aperçu du tracé disponible et une ligne de chiffres. Ouvrez une sortie pour voir le détail.',
  ],
  musique: [
    'Musique',
    'La sélection apparaît dans la préparation et dans Courir. Les imports et la lecture sont simulés.',
  ],
  profil: [
    'Profil',
    'La bannière et les réglages du profil sont privés. L’édition de démonstration reste dans la session du prototype.',
  ],
  carte: [
    'Carte',
    'Les repères du catalogue ouvrent leur fiche. Les résultats restent utilisables au clavier depuis la liste.',
  ],
  activite: [
    'Détail d’activité',
    'Les nombres et le fichier GPX proviennent de l’exemple sélectionné. Export disponible uniquement avec un tracé.',
  ],
  club: ['Fiche club', 'Le contenu et les coordonnées publiques suivent la fiche officielle.'],
  lieu: ['Fiche lieu', 'Le fond d’illustration et les renseignements sourcés restent identifiables.'],
};
