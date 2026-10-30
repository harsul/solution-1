export interface Credentials {
  email: string;
  password: string;
}

export interface UserInfo {
  email: string;
  isEmailConfirmed: boolean;
}

export type SignInResult = 'ok' | 'invalid' | 'lockedOut';

export type ResendResult = 'sent' | 'tooSoon';

export type RegisterResult = { ok: true } | { ok: false; duplicate: boolean; errors: string[] };

interface ProblemDetails {
  detail?: string;
  errors?: Record<string, string[]>;
}

const postJson = (body?: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const unexpected = (response: Response) => new Error(`HTTP error! status: ${response.status}`);

/** Returns the signed-in user, or null when there is no valid session. */
export async function getUserInfo(): Promise<UserInfo | null> {
  const response = await fetch('/api/auth/manage/info');
  if (response.status === 401) return null;
  if (!response.ok) throw unexpected(response);
  return response.json();
}

/** Remember me → persistent cookie (14 days); otherwise the cookie ends with the browser session. */
export async function signIn(credentials: Credentials, rememberMe: boolean): Promise<SignInResult> {
  const mode = rememberMe ? 'useCookies=true' : 'useSessionCookies=true';
  const response = await fetch(`/api/auth/login?${mode}`, postJson(credentials));
  if (response.ok) return 'ok';
  if (response.status === 401) {
    const problem: ProblemDetails | null = await response.json().catch(() => null);
    return problem?.detail === 'LockedOut' ? 'lockedOut' : 'invalid';
  }
  throw unexpected(response);
}

export async function register(credentials: Credentials): Promise<RegisterResult> {
  const response = await fetch('/api/auth/register', postJson(credentials));
  if (response.ok) return { ok: true };
  if (response.status === 400) {
    const problem: ProblemDetails = await response.json();
    const codes = Object.keys(problem.errors ?? {});
    return {
      ok: false,
      duplicate: codes.includes('DuplicateUserName') || codes.includes('DuplicateEmail'),
      errors: Object.values(problem.errors ?? {}).flat(),
    };
  }
  throw unexpected(response);
}

export async function signOut(): Promise<void> {
  const response = await fetch('/api/auth/logout', postJson());
  // 401 means the session was already gone, which is fine for signing out.
  if (!response.ok && response.status !== 401) throw unexpected(response);
}

/** Confirms the email from a confirmation link; false when the link is invalid or expired. */
export async function confirmEmail(userId: string, code: string): Promise<boolean> {
  const query = new URLSearchParams({ userId, code });
  const response = await fetch(`/api/auth/confirmEmail?${query}`);
  if (response.ok) return true;
  if (response.status === 401) return false;
  throw unexpected(response);
}

/** Sends the confirmation email again; 'tooSoon' when rate-limited. */
export async function resendConfirmation(email: string): Promise<ResendResult> {
  const response = await fetch('/api/auth/resendConfirmationEmail', postJson({ email }));
  if (response.ok) return 'sent';
  if (response.status === 429) return 'tooSoon';
  throw unexpected(response);
}
