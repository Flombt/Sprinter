/**
 * Garde-fous du code e-mail (§6.1) : renvoi après 60 s, 5 essais puis délai de 15 min.
 * L'état est conservé localement pour survivre à un redémarrage de l'app.
 */
export const OTP_RESEND_MS = 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_MS = 15 * 60_000;

export interface OtpGuardState {
  email: string | null;
  sentAt: number | null;
  attempts: number;
  lockedUntil: number | null;
}

export const EMPTY_OTP_GUARD: OtpGuardState = { email: null, sentAt: null, attempts: 0, lockedUntil: null };

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const validEmail = (value: string) => /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(normalizeEmail(value)) && value.length <= 254;
export const validCode = (value: string) => /^\d{6}$/.test(value);

export function isLocked(state: OtpGuardState, now: number) {
  return state.lockedUntil !== null && now < state.lockedUntil;
}
export function secondsUntilResend(state: OtpGuardState, now: number) {
  if (isLocked(state, now)) return Math.ceil((state.lockedUntil! - now) / 1000);
  if (state.sentAt === null) return 0;
  return Math.max(0, Math.ceil((state.sentAt + OTP_RESEND_MS - now) / 1000));
}
export function codeSent(state: OtpGuardState, email: string, now: number): OtpGuardState {
  const same = state.email === normalizeEmail(email);
  return { email: normalizeEmail(email), sentAt: now, attempts: same ? state.attempts : 0, lockedUntil: same ? state.lockedUntil : null };
}
export function codeFailed(state: OtpGuardState, now: number): OtpGuardState {
  const attempts = state.attempts + 1;
  return attempts >= OTP_MAX_ATTEMPTS
    ? { ...state, attempts: 0, lockedUntil: now + OTP_LOCK_MS }
    : { ...state, attempts };
}
export function remainingAttempts(state: OtpGuardState) {
  return Math.max(0, OTP_MAX_ATTEMPTS - state.attempts);
}
