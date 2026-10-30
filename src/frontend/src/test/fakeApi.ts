import { vi } from 'vitest';

type Handler = (init: RequestInit | undefined, url: URL) => Response | Promise<Response>;

/** JSON response helper for fake API handlers. */
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const status = (code: number) => new Response(null, { status: code });

/**
 * A tiny fake backend: handlers keyed by "METHOD /path" (query string ignored).
 * Unknown routes answer 404. Returns the fetch spy for call assertions.
 */
export function fakeApi(handlers: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://localhost');
    const handler = handlers[`${init?.method ?? 'GET'} ${url.pathname}`];
    return handler ? handler(init, url) : status(404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Fake backend with an in-memory session: register, login, logout, info and the forecast. */
export function fakeAuthBackend({ signedInAs, emailConfirmed = false }: { signedInAs?: string; emailConfirmed?: boolean } = {}) {
  let session: string | null = signedInAs ?? null;
  const confirmed = new Set<string>(signedInAs && emailConfirmed ? [signedInAs] : []);
  const resent: string[] = [];
  const resetRequests: string[] = [];
  const usedResetCodes = new Set<string>();
  const signedOutOthers: string[] = [];
  const emailChangeRequests: string[] = [];
  const users = new Map<string, string>(signedInAs ? [[signedInAs, 'Passw0rd!']] : []);

  const fetchMock = fakeApi({
    'GET /api/auth/manage/info': () =>
      session ? json({ email: session, isEmailConfirmed: confirmed.has(session) }) : status(401),
    // Confirmation links in tests: userId = the email, code = 'valid'.
    'GET /api/auth/confirmEmail': (_, url) => {
      if (url.searchParams.get('code') !== 'valid') return status(401);
      confirmed.add(url.searchParams.get('userId') ?? '');
      return status(200);
    },
    'POST /api/auth/password/forgot': (init) => {
      resetRequests.push(JSON.parse(String(init?.body)).email);
      return status(200);
    },
    // Reset links in tests: code = 'valid' (works once per email).
    'POST /api/auth/resetPassword': (init) => {
      const { email, resetCode, newPassword } = JSON.parse(String(init?.body));
      if (resetCode !== 'valid' || !users.has(email) || usedResetCodes.has(email)) {
        return json({ errors: { InvalidToken: ['Invalid token.'] } }, 400);
      }
      usedResetCodes.add(email);
      users.set(email, newPassword);
      return status(200);
    },
    'POST /api/account/password': (init) => {
      if (!session) return status(401);
      const { currentPassword, newPassword } = JSON.parse(String(init?.body));
      if (users.get(session) !== currentPassword) {
        return json({ errors: { PasswordMismatch: ['Incorrect password.'] } }, 400);
      }
      users.set(session, newPassword);
      return status(204);
    },
    'POST /api/account/sign-out-others': () => {
      if (!session) return status(401);
      signedOutOthers.push(session);
      return status(204);
    },
    'POST /api/account/delete': (init) => {
      if (!session) return status(401);
      const { password, email } = JSON.parse(String(init?.body));
      if (users.get(session) !== password) return json({ errors: { PasswordMismatch: ['Incorrect password.'] } }, 400);
      if (String(email).trim().toLowerCase() !== session.toLowerCase()) {
        return json({ errors: { EmailMismatch: ["The email address doesn't match this account."] } }, 400);
      }
      users.delete(session);
      session = null;
      return status(204);
    },
    'POST /api/account/email': (init) => {
      if (!session) return status(401);
      const { newEmail, password } = JSON.parse(String(init?.body));
      if (users.get(session) !== password) return json({ errors: { PasswordMismatch: ['Incorrect password.'] } }, 400);
      if (users.has(newEmail)) return json({ errors: { DuplicateEmail: ['In use.'] } }, 400);
      emailChangeRequests.push(newEmail);
      return status(204);
    },
    'POST /api/auth/resendConfirmationEmail': (init) => {
      resent.push(JSON.parse(String(init?.body)).email);
      return status(200);
    },
    'POST /api/auth/register': (init) => {
      const { email, password } = JSON.parse(String(init?.body));
      if (users.has(email)) return json({ errors: { DuplicateUserName: [`Username '${email}' is already taken.`] } }, 400);
      users.set(email, password);
      return status(200);
    },
    'POST /api/auth/login': (init) => {
      const { email, password } = JSON.parse(String(init?.body));
      if (users.get(email) !== password) return json({ detail: 'Failed' }, 401);
      session = email;
      return status(200);
    },
    'POST /api/auth/logout': () => {
      session = null;
      return status(204);
    },
    'GET /api/weatherforecast': () =>
      json([{ date: '2026-11-01', temperatureC: 20, temperatureF: 67, summary: 'Mild' }]),
  });

  return { fetchMock, users, confirmed, resent, resetRequests, signedOutOthers, emailChangeRequests };
}
