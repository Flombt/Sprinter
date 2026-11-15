const $ = (id) => document.getElementById(id);
const device = $('device');
const viewport = $('viewport');
const footer = $('device-footer');
const dialog = $('dialog');
const controls = $('review-controls');
const exhibition = $('exhibition');
const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
const gallery = [
  'bienvenue',
  'courir',
  'preparation',
  'course',
  'bilan',
  'decouvrir',
  'parcours',
  'evenement',
  'progres',
  'seances',
  'historique',
  'musique',
  'profil',
];
const parentScreen = {
  bienvenue: 'courir',
  preparation: 'courir',
  parcours: 'decouvrir',
  evenement: 'decouvrir',
  club: 'decouvrir',
  lieu: 'decouvrir',
  carte: 'decouvrir',
  bilan: 'courir',
  activite: 'historique',
  historique: 'progres',
  musique: 'courir',
  seances: 'preparation',
};
const reviewGroups = [
  ['Course', ['bienvenue', 'courir', 'preparation', 'course', 'bilan', 'seances']],
  ['Exploration', ['decouvrir', 'parcours', 'evenement']],
  ['Activité et profil', ['progres', 'historique', 'musique', 'profil']],
];
const scenarioRoutes = {
  standard: 'courir',
  vide: 'progres',
  chargement: 'decouvrir',
  offline: 'decouvrir',
  erreur: 'decouvrir',
  media: 'decouvrir',
  'gps-refuse': 'preparation',
  depart: 'course',
  'gps-faible': 'course',
  auto: 'course',
  recuperation: 'courir',
  sauvegarde: 'course',
  spotify: 'musique',
};
const comparisonPairs = [
  [
    'courir',
    'Courir',
    'L’accueil propose l’allure et le départ. L’instrumentation GPS apparaît quand on en a besoin.',
  ],
  [
    'preparation',
    'Préparer',
    'L’allure occupe la première place. Chaque option montre la valeur qui sera utilisée au départ.',
  ],
  [
    'course',
    'Début de course',
    'L’allure reste indisponible jusqu’au premier signal exploitable. La pause occupe une grande cible fixe.',
  ],
  [
    'decouvrir',
    'Découvrir',
    'La même Prom’Classic ouvre la page. Une seule rangée de catégories précède les résultats.',
  ],
  [
    'evenement',
    'Fiche événement',
    'La photo situe le lieu et la date reste lisible en dehors de l’image. Le site officiel et la préparation sont accessibles en bas.',
  ],
  [
    'progres',
    'Activité sans historique',
    'Le premier écran de progression donne une suite au compte vide. Un exemple reste accessible à la demande.',
  ],
  [
    'musique',
    'Bibliothèque vide',
    'L’import demeure l’action principale, depuis une bibliothèque reliée aux parcours de préparation et de course.',
  ],
];
const params = new URLSearchParams(location.search);
const capture = params.get('capture') === '1';
const positions = new Map();
let demo = makeDemo();
let current;
let mode = 'prototype';
let sheet = '';
let returnFocus = null;
let countdownTimer = 0;
let pendingSave = 0;
let toastTimer = 0;
let holdTimer = 0;
let holdCompleted = false;
let morph = null;
let changeSerial = 0;
let compareKey = 'courir';

function makeDemo(scenario = 'standard', preferences = {}) {
  return {
    scenario,
    direction: preferences.direction || 'a',
    dark: !!preferences.dark,
    reduce: !!preferences.reduce,
    opaque: !!preferences.opaque,
    large: !!preferences.large,
    pace: 300,
    range: 0,
    distance: 0,
    category: 'all',
    discoveryFilter: 'all',
    search: '',
    pin: '',
    catalogRecovered: false,
    historyFilter: 'all',
    period: 'week',
    workoutFilter: 'Tout',
    voice: true,
    shoes: false,
    workout: '',
    playlist: '',
    imported: [],
    favorites: new Set(),
    profileName: scenario === 'vide' ? '' : 'Camille',
    banner: 'cote',
    route: null,
    objective: null,
    saved: null,
    run: null,
    countdown: 3,
    saveError: false,
    saveRetried: false,
  };
}

function targetLabel() {
  return demo.range
    ? `${paceText(demo.pace - demo.range)}–${paceText(demo.pace + demo.range)}`
    : paceText(demo.pace);
}

function parseRoute(raw) {
  const [requested, value = ''] = raw.split('/');
  const id = Object.hasOwn(views, requested) ? requested : 'courir';
  const keepValue = value && /^[0-9a-z-]+$/.test(value);
  return { id, value: keepValue ? value : '', key: keepValue ? `${id}/${value}` : id };
}

function setUrl(key, parent = '', method = 'pushState') {
  if (location.hash === '#' + key && method === 'pushState') method = 'replaceState';
  history[method]({ sprinter: true, key, parent }, '', '#' + key);
}

function elapsedRun() {
  const run = demo.run;
  if (!run) return 0;
  return run.seconds + (run.phase === 'running' ? Math.floor((performance.now() - run.resumedAt) / 1000) : 0);
}

function seededRun(phase = 'running') {
  const example = demoRuns[0];
  return {
    phase,
    seconds: example.seconds,
    meters: example.meters,
    pace: 302,
    track: example.track,
    resumedAt: performance.now(),
    showTrack: true,
  };
}

function firstRunFrame() {
  return {
    phase: 'running',
    seconds: 0,
    meters: 0,
    pace: 0,
    track: null,
    resumedAt: performance.now(),
    showTrack: false,
  };
}

function preparePreview(id) {
  if (id === 'course' && !demo.run) {
    demo.run =
      demo.scenario === 'depart' ? firstRunFrame() : seededRun(demo.scenario === 'auto' ? 'auto' : 'running');
  }
  if (id !== 'course' && demo.run?.phase === 'running') {
    demo.run.seconds = elapsedRun();
    demo.run.phase = 'paused';
  }
}

function matchesDiscoveryFilter(item) {
  return {
    all: true,
    nice: item.city === 'Nice',
    outside: item.city !== 'Nice',
    ten: item.kind === 'race' && item.distancesKm?.includes(10),
  }[demo.discoveryFilter];
}

function reduceMotion() {
  return demo.reduce || systemMotion.matches;
}

function savePosition() {
  if (!current || mode !== 'prototype') return;
  const button = document.activeElement;
  positions.set(current.key, {
    top: viewport.scrollTop,
    action: button?.dataset?.action,
    value: button?.dataset?.value,
  });
}

function focusedControl(position, root = device) {
  if (!position?.action || position.action === 'tab') return null;
  return [...root.querySelectorAll('[data-action]')].find(
    (button) => button.dataset.action === position.action && button.dataset.value === position.value,
  );
}

function syncControls() {
  controls.elements.direction.value = demo.direction;
  controls.elements.scenario.value = demo.scenario;
  controls.elements.dark.checked = demo.dark;
  controls.elements.reduce.checked = demo.reduce;
  controls.elements.opaque.checked = demo.opaque;
  controls.elements.large.checked = demo.large;
}

function renderView({ effect = '', preserveScroll = false, focus = '', previousTab = '' } = {}) {
  const top = viewport.scrollTop;
  const priorControl = {
    action: document.activeElement?.dataset?.action,
    value: document.activeElement?.dataset?.value,
  };
  const frame = views[current.id](current);
  device.dataset.theme = demo.dark || demo.direction === 'b' ? 'sombre' : 'clair';
  device.dataset.direction = demo.direction;
  device.dataset.screen = current.id;
  device.dataset.tone = frame.tone;
  device.dataset.reduce = String(reduceMotion());
  device.dataset.opaque = String(demo.opaque);
  device.dataset.large = String(demo.large);
  device.dataset.bottom = String(Boolean(frame.footer));
  viewport.innerHTML = `<div class="screen-content" data-effect="${reduceMotion() ? '' : effect}">${frame.main}</div>`;
  footer.innerHTML = frame.footer;
  const nav = footer.querySelector('.tab-bar');
  if (nav && previousTab && !reduceMotion()) {
    const before = tabInfo.findIndex(([id]) => id === previousTab);
    if (before >= 0) {
      nav.style.setProperty('--previous-position', before);
      nav.classList.add('tab-switched');
    }
  }
  const old = positions.get(current.key);
  viewport.scrollTop = preserveScroll ? top : old?.top || 0;
  if (focus === 'screen') {
    if (viewport.scrollTop > 0) {
      (focusedControl(old, viewport) || viewport).focus({ preventScroll: true });
    } else {
      (viewport.querySelector('h1') || viewport).focus({ preventScroll: true });
    }
  } else if (focus === 'control') {
    focusedControl(priorControl)?.focus({ preventScroll: true });
  } else if (focus === 'tab') {
    footer.querySelector('[aria-current]')?.focus();
  }
  const [title, note] = reviewNotes[current.id];
  $('review-title').textContent = title;
  $('review-note').textContent = note;
  document.querySelectorAll('[data-review]').forEach((node) => {
    if (node.dataset.review === current.id) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  });
  if (dialog.open) placeDialog();
}

function setMode(next) {
  mode = next;
  $('workspace').hidden = next !== 'prototype';
  exhibition.hidden = next === 'prototype';
  document.querySelectorAll('[data-mode]').forEach((link) => {
    if (link.dataset.mode === next) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function sheetMorphism(target, effect) {
  if (reduceMotion() || !document.startViewTransition || mode !== 'prototype' || effect !== 'detail')
    return null;
  const id = target.value || (target.id === 'decouvrir' ? current.value : '');
  const from = [...viewport.querySelectorAll('[data-photo-key]')].find((el) => el.dataset.photoKey === id);
  if (!from || !id) return null;
  const rect = from.getBoundingClientRect(),
    bounds = viewport.getBoundingClientRect();
  return rect.top < bounds.bottom && rect.bottom > bounds.top ? { from, id } : null;
}

function changeView(
  key,
  { parent = '', effect = '', method = 'pushState', updateUrl = true, focus = 'screen' } = {},
) {
  const version = ++changeSerial;
  const next = parseRoute(key);
  const previousTab = current?.id;
  const shared = sheetMorphism(next, effect);
  morph?.skipTransition();
  savePosition();
  closeSheet();
  if (updateUrl) setUrl(next.key, parent, method);
  function apply() {
    if (version !== changeSerial) return false;
    current = next;
    preparePreview(current.id);
    setMode('prototype');
    renderView({ effect, focus, previousTab: effect === 'tab' ? previousTab : '' });
    return true;
  }
  if (shared) {
    shared.from.style.viewTransitionName = 'fiche-cover';
    let to;
    const transition = document.startViewTransition(() => {
      if (!apply()) return;
      to = [...viewport.querySelectorAll('[data-photo-key]')].find((el) => el.dataset.photoKey === shared.id);
      if (to) to.style.viewTransitionName = 'fiche-cover';
    });
    morph = transition;
    // A new gesture can skip the animation while the navigation still completes.
    transition.ready.catch(() => {});
    const finishTransition = () => {
      shared.from.style.viewTransitionName = '';
      if (to && to.isConnected && morph === transition) to.style.viewTransitionName = '';
      if (morph === transition) morph = null;
    };
    transition.finished.then(finishTransition, finishTransition);
  } else apply();
}

function open(key) {
  const id = parseRoute(key).id;
  if (id === 'preparation' && demo.run) return showSheet('course-en-pause');
  if (id === 'carte') demo.pin = '';
  const effect = ['parcours', 'evenement', 'club', 'lieu', 'activite'].includes(id)
    ? 'detail'
    : id === 'musique'
      ? 'music'
      : id === 'carte'
        ? 'map'
        : 'push';
  changeView(key, { parent: current.key, effect });
}

function goBack() {
  const back = history.state?.parent;
  if (back) {
    history.back();
  } else {
    changeView(parentScreen[current.id] || 'courir', { method: 'replaceState', effect: 'return' });
  }
}

function showPreset(key, options = {}) {
  clearTimeout(pendingSave);
  demo.run = null;
  demo.saveError = false;
  const item = { parcours: featuredRoute, evenement: featured }[key];
  changeView(item ? itemRoute(item) : key, options);
}

function readHash() {
  const key = location.hash.slice(1) || 'courir';
  if (key === 'maquettes' || key === 'comparatif') {
    changeSerial += 1;
    morph?.skipTransition();
    savePosition();
    closeSheet();
    if (demo.run?.phase === 'running') {
      demo.run.seconds = elapsedRun();
      demo.run.phase = 'paused';
    }
    setMode(key);
    renderExhibition();
    return;
  }
  if (mode === 'prototype' && current?.key === key) return;
  const previous = current;
  const effect =
    ['parcours', 'evenement', 'lieu', 'club'].includes(previous?.id) && key === 'decouvrir'
      ? 'detail'
      : 'return';
  changeView(key, { updateUrl: false, effect, focus: current ? 'screen' : '' });
}

function renderExhibition() {
  if (mode === 'maquettes') {
    exhibition.innerHTML = `<header class="exhibition-title"><h1>Maquettes</h1>
      <p>Treize écrans de la proposition Editorial Coast, capturés à 390 × 844. Sélectionnez un écran pour l’essayer.</p></header>
      <div class="gallery">${gallery
        .map(
          (key) => `<figure><a href="#${key}" data-review="${key}">
        <img src="captures/apres/${key}.webp" loading="lazy" width="390" height="844" alt="Essayer l’écran ${escapeMarkup(reviewNotes[key][0])}" />
        </a><figcaption>${escapeMarkup(reviewNotes[key][0])}</figcaption></figure>`,
        )
        .join('')}</div>`;
    return;
  }
  const [key, label, note] = comparisonPairs.find(([id]) => id === compareKey);
  const before = { progres: 'stats', musique: 'spotify' }[key] || key;
  exhibition.innerHTML = `<header class="exhibition-title"><h1>Avant / après</h1>
    <p>Application web actuelle et proposition iOS, au format 390 × 844, en thème sombre et avec les mêmes états de départ.</p></header>
    <nav class="compare-links" aria-label="Écrans à comparer">${comparisonPairs
      .map(
        ([id, title]) =>
          `<button type="button" data-compare="${id}" aria-pressed="${id === key}">${title}</button>`,
      )
      .join('')}</nav>
    <section class="comparison-intro"><h2>${label}</h2><p>${note}</p></section>
    <div class="compare-pair">
      <figure><figcaption>Avant · application web actuelle</figcaption>
        <img src="captures/avant/${before}.webp" width="390" height="844" alt="Interface actuelle, ${label}" /></figure>
      <figure><figcaption>Après · maquette Editorial Coast</figcaption>
        <img src="captures/comparatif/${key}.webp" width="390" height="844" alt="Interface proposée, ${label}" /></figure>
    </div>`;
}

function placeDialog() {
  const rect = device.getBoundingClientRect();
  dialog.style.setProperty('--dialog-left', rect.left + 'px');
  dialog.style.setProperty('--dialog-top', rect.top + 'px');
  dialog.style.setProperty('--dialog-width', rect.width + 'px');
  dialog.style.setProperty('--dialog-height', rect.height + 'px');
}

function showSheet(key) {
  const content = sheetContent(key);
  if (!content) return;
  if (!dialog.open) returnFocus = document.activeElement;
  sheet = key;
  dialog.innerHTML = `<div class="sheet-panel">
    <header><h2 id="sheet-title" tabindex="-1">${escapeMarkup(content.title)}</h2>
      ${iconButton('close', 'Fermer', 'dismiss')}</header>
    <div class="sheet-body">${content.body}</div></div>`;
  placeDialog();
  if (!dialog.open) dialog.showModal();
  (dialog.querySelector('[autofocus]') || $('sheet-title')).focus({ preventScroll: true });
}

function closeSheet() {
  clearInterval(countdownTimer);
  if (!dialog.open) return;
  sheet = '';
  dialog.close();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}

function announce(text) {
  clearTimeout(toastTimer);
  const toast = $('toast');
  toast.textContent = text;
  toast.dataset.visible = 'true';
  toastTimer = setTimeout(() => {
    toast.dataset.visible = 'false';
    toast.textContent = '';
  }, 2600);
}

function updateCurrent(effect = '') {
  renderView({ effect, preserveScroll: true, focus: 'control' });
}

function updateAfterSheet() {
  closeSheet();
  updateCurrent();
}

function start() {
  if (current.id === 'course' || sheet === 'countdown') return;
  if (demo.scenario === 'gps-refuse') return showSheet('gps-refuse');
  if (demo.scenario === 'recuperation') {
    demo.run = seededRun('paused');
    demo.scenario = 'standard';
    syncControls();
    return changeView('course', { effect: 'start' });
  }
  demo.countdown = 3;
  showSheet('countdown');
  countdownTimer = setInterval(() => {
    demo.countdown -= 1;
    if (demo.countdown > 0) {
      $('countdown-number').textContent = demo.countdown;
      return;
    }
    closeSheet();
    demo.run = firstRunFrame();
    changeView('course', { effect: 'start' });
  }, 1000);
}

function togglePause() {
  if (!demo.run || demo.run.phase === 'saving') return;
  const run = demo.run;
  if (run.phase === 'paused') {
    run.phase = 'running';
    run.resumedAt = performance.now();
  } else {
    run.seconds = elapsedRun();
    run.phase = 'paused';
  }
  updateCurrent('pause');
  announce(run.phase === 'paused' ? 'Course en pause' : 'Course reprise');
}

function finish() {
  closeSheet();
  const run = demo.run;
  if (!run || run.phase === 'saving') return;
  const seconds = elapsedRun();
  run.phase = 'saving';
  updateCurrent();
  pendingSave = setTimeout(() => {
    if (demo.scenario === 'sauvegarde' && !demo.saveRetried) {
      demo.saveRetried = true;
      demo.saveError = true;
      run.phase = 'paused';
      run.seconds = seconds;
      updateCurrent();
      viewport.querySelector('.notice.danger')?.setAttribute('role', 'alert');
      $('hold-finish')?.focus({ preventScroll: true });
      return;
    }
    demo.saved = {
      id: 'demo-fin',
      title: 'Sortie du jour',
      day: 15,
      meters: run.meters,
      seconds,
      track: run.track,
    };
    demo.run = null;
    demo.saveError = false;
    changeView('bilan', { effect: 'saved', method: 'replaceState' });
  }, 700);
}

function downloadDemo(name, content, mime) {
  const address = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = address;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(address), 4000);
}

function exportRun(id) {
  const run = [...allRuns(), ...demoRuns].find((record) => record.id === id);
  if (!run?.track?.length) return announce('Aucun tracé à exporter.');
  const points = run.track.map(([lat, lon]) => `<trkpt lat="${lat}" lon="${lon}"/>`).join('\n');
  downloadDemo(
    'sprinter-demonstration.gpx',
    `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Sprinter prototype" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>${escapeMarkup(run.title)} (démonstration)</name><trkseg>${points}</trkseg></trk>
</gpx>`,
    'application/gpx+xml',
  );
}

function exportCalendar(id) {
  const item = discoveryItems.find((candidate) => candidate.id === id);
  const icsDate = (date) =>
    new Date(date)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sprinter//Prototype//FR',
    'BEGIN:VEVENT',
    `UID:${item.id}@sprinter-demo.invalid`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(item.schedule.startAt)}`,
    `SUMMARY:${item.title} (démo Sprinter)`,
    `URL:${item.officialUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ];
  downloadDemo('sprinter-evenement-demo.ics', content.join('\r\n'), 'text/calendar;charset=utf-8');
}

function selectFromDiscovery(id) {
  if (demo.run) return showSheet('course-en-pause');
  const item = discoveryItems.find((candidate) => candidate.id === id);
  if (item.kind === 'race') {
    demo.objective = item;
    demo.distance = item.distancesKm?.[0] || 0;
  } else demo.route = item;
  open('preparation');
}

function chooseWorkout(id) {
  demo.workout = id;
  if (history.state?.parent?.startsWith('preparation')) goBack();
  else changeView('preparation', { effect: 'push', method: 'replaceState' });
  closeSheet();
}

const commands = {
  tab: (id) => changeView(id, { effect: 'tab', focus: 'tab' }),
  open,
  back: goBack,
  sheet: showSheet,
  dismiss: closeSheet,
  'enter-session': () => changeView('courir', { effect: 'start' }),
  'return-run': () => changeView('course', { effect: 'return' }),
  start,
  pause: togglePause,
  finish,
  'toggle-track': () => {
    demo.run.showTrack = !demo.run.showTrack;
    updateCurrent('map');
  },
  'set-distance': (value) => {
    demo.distance = Number(value);
    updateAfterSheet();
  },
  'workout-filter': (value) => {
    demo.workoutFilter = value;
    updateCurrent('filter');
  },
  'select-workout': chooseWorkout,
  'select-playlist': (id) => {
    demo.playlist = demo.playlist === id ? '' : id;
    updateAfterSheet();
    announce(demo.playlist ? 'Playlist prête pour la sortie' : 'Playlist retirée');
  },
  'toggle-voice': () => {
    demo.voice = !demo.voice;
    showSheet(sheet);
  },
  'select-shoes': (value) => {
    demo.shoes = value === '1';
    updateAfterSheet();
  },
  'toggle-theme': () => {
    demo.dark = !demo.dark;
    syncControls();
    updateCurrent();
    showSheet(sheet);
  },
  category: (value) => {
    demo.category = value;
    updateCurrent('filter');
  },
  'discovery-filter': (value) => {
    demo.discoveryFilter = value;
    updateAfterSheet();
  },
  'clear-filter': () => {
    demo.discoveryFilter = 'all';
    updateCurrent();
  },
  'retry-catalogue': () => {
    demo.catalogRecovered = true;
    updateCurrent('filter');
    announce('Catalogue rechargé en démonstration');
  },
  'from-discovery': selectFromDiscovery,
  'clear-route': () => {
    demo.route = null;
    updateAfterSheet();
  },
  pin: (value) => {
    demo.pin = value || '';
    updateCurrent();
  },
  favorite: (id) => {
    const added = !demo.favorites.has(id);
    if (added) demo.favorites.add(id);
    else demo.favorites.delete(id);
    updateCurrent();
    const favoriteIcon = device.querySelector('[data-action="favorite"]');
    if (favoriteIcon && !reduceMotion())
      favoriteIcon.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], 130);
    announce(added ? 'Fiche ajoutée aux favoris' : 'Fiche retirée des favoris');
  },
  'history-filter': (value) => {
    demo.historyFilter = value;
    updateCurrent('filter');
  },
  period: (value) => {
    demo.period = value;
    updateCurrent('graph');
  },
  gpx: exportRun,
  ics: exportCalendar,
};

function playlistId(input) {
  const uri = /^spotify:playlist:([A-Za-z0-9]{22})$/.exec(input);
  if (uri) return uri[1];
  try {
    const url = new URL(input);
    const id = /^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?playlist\/([A-Za-z0-9]{22})\/?$/.exec(url.pathname)?.[1];
    return url.origin === 'https://open.spotify.com' && !url.username && !url.password && !url.hash
      ? id
      : null;
  } catch {
    return null;
  }
}

dialog.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  if (event.target.id === 'form-pace') {
    demo.pace = Number(data.get('minutes')) * 60 + Number(data.get('seconds'));
    demo.range = Number(data.get('range'));
  }
  if (event.target.id === 'form-profile') {
    demo.profileName = String(data.get('profileName')).trim();
    demo.banner = String(data.get('banner'));
  }
  if (event.target.id === 'form-playlist') {
    const id = playlistId(String(data.get('playlist')).trim());
    if (!id) {
      $('playlist-error').hidden = false;
      event.target.elements.playlist.setAttribute('aria-invalid', 'true');
      event.target.elements.playlist.setAttribute('aria-describedby', 'playlist-error');
      event.target.elements.playlist.focus();
      return;
    }
    if (!demo.imported.some((item) => item.id === id)) {
      demo.imported.push({
        id,
        name: 'Playlist importée',
        meta: 'Lien Spotify · métadonnées indisponibles dans la démo',
        image: 'affichePiste',
        tracks: [],
        url: `https://open.spotify.com/playlist/${id}`,
      });
    }
    demo.playlist = id;
  }
  updateAfterSheet();
  announce('Sélection enregistrée dans la démo');
});

dialog.addEventListener('input', (event) => {
  if (event.target.id !== 'search-query') return;
  demo.search = event.target.value;
  $('search-results').innerHTML = searchResults();
});
dialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeSheet();
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeSheet();
});
device.addEventListener(
  'error',
  (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.dataset.fallback) return;
    const fallback = image.dataset.fallback;
    delete image.dataset.fallback;
    image.src = fallback;
    if (image.alt) image.alt = media.horizon[1];
  },
  true,
);

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action], [data-review], [data-compare]');
  if (!button) return;
  if (button.dataset.review) {
    event.preventDefault();
    showPreset(button.dataset.review);
    return;
  }
  if (button.dataset.compare) {
    compareKey = button.dataset.compare;
    renderExhibition();
    exhibition.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
    return;
  }
  if (button.id === 'hold-finish' && holdCompleted) {
    holdCompleted = false;
    return;
  }
  commands[button.dataset.action]?.(button.dataset.value);
});

device.addEventListener('pointerdown', (event) => {
  const hold = event.target.closest('#hold-finish');
  if (!hold || event.button !== 0) return;
  holdCompleted = false;
  hold.dataset.holding = 'true';
  holdTimer = setTimeout(() => {
    holdCompleted = true;
    finish();
  }, 1000);
});
function releaseHold() {
  clearTimeout(holdTimer);
  device.querySelector('#hold-finish')?.removeAttribute('data-holding');
}
for (const name of ['pointerup', 'pointercancel', 'pointermove']) {
  document.addEventListener(name, (event) => {
    if (name !== 'pointermove' || !event.target.closest('#hold-finish')) releaseHold();
  });
}

controls.addEventListener('change', (event) => {
  const { name, value, checked } = event.target;
  if (name === 'scenario') {
    demo = makeDemo(value, demo);
    positions.clear();
    showPreset(scenarioRoutes[value]);
    return;
  }
  demo[name] = name === 'direction' ? value : checked;
  updateCurrent();
});
controls.addEventListener('reset', (event) => {
  event.preventDefault();
  demo = makeDemo();
  syncControls();
  positions.clear();
  showPreset('courir');
});

addEventListener('hashchange', readHash);
addEventListener('popstate', readHash);
addEventListener('resize', () => {
  if (dialog.open) placeDialog();
});
addEventListener(
  'scroll',
  () => {
    if (dialog.open) placeDialog();
  },
  { passive: true },
);
systemMotion.addEventListener('change', () => {
  if (mode === 'prototype') updateCurrent();
});
setInterval(() => {
  const time = $('run-time');
  if (time && demo.run?.phase === 'running') time.textContent = clockText(elapsedRun());
}, 250);

$('screen-links').innerHTML = reviewGroups
  .map(
    ([group, screens]) => `<div class="screen-link-group">
  <p class="studio-label">${group}</p>${screens
    .map(
      (id) => `<a href="#${id}" data-review="${id}">
    <span>${reviewNotes[id][0]}</span>${icon('next')}</a>`,
    )
    .join('')}</div>`,
  )
  .join('');
$('status-icons').innerHTML = icon('signal') + icon('wifi') + icon('battery');

if (capture) {
  document.documentElement.dataset.capture = 'true';
  const requested = params.get('scenario');
  const scenario = Object.hasOwn(scenarioRoutes, requested) ? requested : 'standard';
  demo = makeDemo(scenario, {
    dark: params.get('theme') === 'dark',
    large: params.get('large') === '1',
    direction: ['a', 'b', 'c'].includes(params.get('direction')) ? params.get('direction') : 'a',
  });
}
syncControls();
readHash();
