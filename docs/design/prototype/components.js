const iconPaths = {
  run: '<circle cx="16.5" cy="4.5" r="2" fill="currentColor" stroke="none"/><path d="m11 8 3-1 3 4 3 1M14 8l-4 6 4 3-2 5M10 14l-3 5H3M11 8l-4 3H4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5Z"/>',
  chart: '<path d="M3 20h18M6 16v-4m6 4V8m6 8V4"/>',
  user: '<circle cx="12" cy="8" r="3.4"/><path d="M4.5 20v-1a5 5 0 0 1 5-5h5a5 5 0 0 1 5 5v1"/>',
  music:
    '<path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  back: '<path d="m14 18-6-6 6-6"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M3 12h17m-6-6 6 6-6 6"/>',
  external: '<path d="M7 17 17 7M7 7h10v10"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  play: '<path d="M7 4.5v15l13-7.5Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 5v14m6-14v14" stroke-width="3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.6" fill="currentColor" stroke="none"/>',
  layers: '<path d="m12 4 9 5-9 5-9-5Zm9 9-9 5-9-5m18 4-9 5-9-5"/>',
  target:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="10.7" cy="10.7" r="5.7"/><path d="m15 15 5 5"/>',
  filter:
    '<path d="M3 6h18M3 12h18M3 18h18"/><circle cx="8" cy="6" r="2" fill="var(--surface)"/><circle cx="16" cy="12" r="2" fill="var(--surface)"/><circle cx="10" cy="18" r="2" fill="var(--surface)"/>',
  heart: '<path d="M12 20 4.7 12.7a4.5 4.5 0 0 1 6.4-6.4l.9.9.9-.9a4.5 4.5 0 1 1 6.4 6.4Z"/>',
  pin: '<path d="M19 10c0 4.4-7 10-7 10s-7-5.6-7-10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>',
  route:
    '<circle cx="5.5" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M7.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  map: '<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2ZM9 4v14m6-12v14"/>',
  flag: '<path d="M5 21V4c5-3 8 3 14 0v11c-6 3-9-3-14 0"/>',
  zap: '<path d="m13 2-8 12h6l-1 8 9-12h-6Z"/>',
  more: '<circle cx="5" cy="12" r="1.15" fill="currentColor"/><circle cx="12" cy="12" r="1.15" fill="currentColor"/><circle cx="19" cy="12" r="1.15" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  down: '<path d="M12 4v11m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  alert: '<path d="m11 4-8 14a1 1 0 0 0 1 1.5h16a1 1 0 0 0 1-1.5L13 4a1.1 1.1 0 0 0-2 0Zm1 5v4m0 3v.1"/>',
  signal: '<path d="M4 20v-3m5 3v-6m5 6V9m5 11V5" stroke-width="2.4"/>',
  wifi: '<path d="M3 9a15 15 0 0 1 18 0M6 13a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0m-3 3h.01" stroke-width="2.2"/>',
  battery:
    '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10v4"/><rect x="4" y="9" width="14" height="6" fill="currentColor" stroke="none" rx="1"/>',
  calendar:
    '<rect x="4" y="6" width="16" height="15" rx="2"/><path d="M8 4v4m8-4v4M4 11h16m-11 4h.01m3 0h.01m3 0h.01"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/>',
  shoe: '<path d="M3 16c2-1 3-3 4-7h2l3 5 7 1c1 0 2 1 2 2v2H3Zm8-4-2 2m5 0-2 2"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || ''}</svg>`;
}

const displayNumber = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const distanceText = (meters) => displayNumber.format(meters / 1000);
const clockText = (seconds) =>
  [Math.floor(seconds / 60), seconds % 60].map((value) => String(value).padStart(2, '0')).join(':');
const paceText = (seconds) => (seconds ? clockText(seconds).replace(/^0/, '') : '—');
const datesInParis = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
});
const eventDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});
const eventTime = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});
const imageRoot = '../../../assets/discovery/';
const media = {
  rive: ['media/rive.webp', 'Silhouette qui court entre une rive sombre et la lumière du matin.'],
  aube: ['media/aube.webp', 'Une personne court dans un champ au milieu de la brume.'],
  piste: ['media/piste.webp', 'Virage d’une piste rouge vue depuis les couloirs.'],
  promenade: [imageRoot + 'promenade.webp', 'La Promenade des Anglais longe la plage à Nice.'],
  gairaut: [imageRoot + 'gairaut.webp', 'La cascade de Gairaut sous une maison de style alpin.'],
  villefranche: [imageRoot + 'villefranche.webp', 'La rade et le port de Villefranche-sur-Mer.'],
  vence: [imageRoot + 'vence.webp', 'Les toits et la tour de pierre du centre de Vence.'],
  cote: ['media/illustration-cote.webp', 'Illustration d’une côte turquoise au crépuscule.'],
  horizon: ['media/illustration-horizon.webp', 'Illustration d’une côte et d’un ciel au lever du jour.'],
  coureuse: ['media/illustration-course.webp', 'Illustration d’une silhouette en mouvement.'],
  montagnes: ['media/illustration-montagne.webp', 'Illustration de lignes de montagnes dans la brume.'],
  affichePiste: ['media/illustration-piste.webp', 'Illustration d’une piste en terre cuite.'],
};

function escapeMarkup(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}

function photo(key, { position = 'center', decorative = false, unavailable = false } = {}) {
  const [source, alt] = unavailable ? media.horizon : media[key] || media.horizon;
  return `<img class="photo" src="${source}" alt="${decorative ? '' : escapeMarkup(alt)}"
    data-fallback="${media.horizon[0]}" style="object-position:${position}" decoding="async" />`;
}

function brand() {
  return '<span class="app-brand"><span class="speed-mark" aria-hidden="true"></span> Sprinter</span>';
}

function action(label, command, { glyph = 'arrow', style = 'primary', value = '', attributes = '' } = {}) {
  return `<button type="button" class="action ${style}" data-action="${command}" data-value="${escapeMarkup(value)}" ${attributes}>
    <span>${escapeMarkup(label)}</span>${glyph ? icon(glyph) : ''}
  </button>`;
}

function iconButton(glyph, label, command, value = '', attributes = '') {
  return `<button type="button" class="icon-button" aria-label="${escapeMarkup(label)}" title="${escapeMarkup(label)}"
    data-action="${command}" data-value="${escapeMarkup(value)}" ${attributes}>${icon(glyph)}</button>`;
}

function externalLink(label, url, style = 'quiet') {
  return `<a class="action ${style}" href="${escapeMarkup(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeMarkup(label)} (nouvel onglet)">
    <span>${escapeMarkup(label)}</span>${icon('external')}
  </a>`;
}

function textButton(label, command, value = '', attributes = '') {
  return `<button type="button" class="text-button" data-action="${command}" data-value="${escapeMarkup(value)}" ${attributes}>${escapeMarkup(label)}</button>`;
}

function appHeader(
  title,
  { back = false, trailing = '', branded = false, eyebrow = '', subtitle = '' } = {},
) {
  const header = branded ? brand() : `<h1 tabindex="-1">${escapeMarkup(title)}</h1>`;
  return `<header class="app-header ${branded ? 'app-header--brand' : ''} ${back ? 'app-header--subpage' : ''}">
    ${back ? iconButton('back', 'Retour', 'back') : ''}
    <div class="header-main">${eyebrow ? `<p class="kicker">${escapeMarkup(eyebrow)}</p>` : ''}${header}
    ${subtitle ? `<p class="header-subtitle">${escapeMarkup(subtitle)}</p>` : ''}</div>${trailing}
  </header>`;
}

function sectionHeader(title, trailing = '') {
  return `<header class="section-header"><h2>${escapeMarkup(title)}</h2>${trailing}</header>`;
}

function row(label, detail, glyph, command, value = '') {
  return `<button type="button" class="detail-row" data-action="${command}" data-value="${escapeMarkup(value)}">
    <span class="row-icon">${icon(glyph)}</span><span class="row-copy"><strong>${escapeMarkup(label)}</strong>
    ${detail ? `<small>${escapeMarkup(detail)}</small>` : ''}</span><span class="row-end">${icon('next')}</span>
  </button>`;
}

function chipButton(label, command, value, selected) {
  return `<button type="button" class="chip" aria-pressed="${selected}" data-action="${command}" data-value="${escapeMarkup(value)}">
    ${escapeMarkup(label)}
  </button>`;
}

function notice(title, body, { tone = '', glyph = 'alert', extra = '' } = {}) {
  return `<aside class="notice ${tone}">
    <span class="notice-icon">${icon(glyph)}</span>
    <div><strong>${escapeMarkup(title)}</strong>${body ? `<p>${escapeMarkup(body)}</p>` : ''}${extra}</div>
  </aside>`;
}

function metric(label, value, unit = '') {
  return `<div class="metric"><dt>${escapeMarkup(label)}</dt>
    <dd>${escapeMarkup(value)}${unit ? ` <small>${escapeMarkup(unit)}</small>` : ''}</dd></div>`;
}

function trace(track) {
  if (!track || track.length < 2)
    return `<div class="trace-empty">${icon('route')} <span>Aucun tracé disponible</span></div>`;
  const ys = track.map(([lat]) => lat);
  const xs = track.map(([, lon]) => lon * Math.cos((ys[0] * Math.PI) / 180));
  const xMin = Math.min(...xs),
    yMin = Math.min(...ys);
  const width = Math.max(...xs) - xMin,
    height = Math.max(...ys) - yMin;
  const scale = Math.min(258 / (width || 0.0001), 104 / (height || 0.0001));
  const path = xs.map((x, i) => [
    Math.round(150 - (width * scale) / 2 + (x - xMin) * scale),
    Math.round(70 + (height * scale) / 2 - (ys[i] - yMin) * scale),
  ]);
  const [startX, startY] = path[0];
  const [endX, endY] = path.at(-1);
  return `<div class="trace">
    <svg viewBox="0 0 300 140" role="img" aria-label="Aperçu du tracé de démonstration" preserveAspectRatio="xMidYMid meet">
      <polyline points="${path.map((point) => point.join(',')).join(' ')}" class="trace-line" />
      <circle cx="${startX}" cy="${startY}" r="4" class="trace-start" />
      <circle cx="${endX}" cy="${endY}" r="5.4" class="trace-end" />
    </svg>
  </div>`;
}

const tabInfo = [
  ['courir', 'Courir', 'run'],
  ['decouvrir', 'Découvrir', 'compass'],
  ['progres', 'Progrès', 'chart'],
  ['profil', 'Profil', 'user'],
];

function tabBar(selected) {
  const position = tabInfo.findIndex(([id]) => id === selected);
  return `<nav class="tab-bar" aria-label="Navigation Sprinter" style="--position:${position}">
    <span class="tab-marker" aria-hidden="true"></span>
    ${tabInfo
      .map(
        ([id, label, glyph]) => `<button type="button" data-action="tab" data-value="${id}"
      ${id === selected ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></button>`,
      )
      .join('')}
  </nav>`;
}
