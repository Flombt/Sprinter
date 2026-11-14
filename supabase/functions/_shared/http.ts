// Réponses HTTP communes. Aucune donnée personnelle ni détail technique dans les erreurs.

export const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

/** Origines web autorisées (page publique de suppression, site admin), séparées par des virgules. */
export function corsHeaders(request: Request, allowed: string | undefined): Record<string, string> {
  const origin = request.headers.get('Origin');
  const origins = (allowed ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!origin || !origins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

export function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...extra },
  });
}

export function bearer(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(header.trim());
  return match?.[1] ?? null;
}

/** Comparaison en temps constant (secret de déclenchement des tâches planifiées). */
export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a), right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return diff === 0;
}

/** Identifiant de corrélation à communiquer au support, sans lien avec l'utilisateur. */
export const correlationId = () => crypto.randomUUID().slice(0, 8);

export function logEvent(event: string, data: Record<string, unknown> = {}) {
  // Journaux sans PII : jamais d'e-mail, de jeton, de coordonnées ni d'identifiant de course.
  console.log(JSON.stringify({ event, ...data }));
}
