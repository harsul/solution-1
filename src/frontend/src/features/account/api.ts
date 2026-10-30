import { apiFetch } from '../../api/apiFetch';

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; code: 'wrongPassword' | 'lockedOut' | 'rules'; errors: string[] };

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; code: 'wrongPassword' | 'lockedOut' | 'emailMismatch' };

interface ValidationProblem {
  errors?: Record<string, string[]>;
}

const postJson = (body?: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const unexpected = (response: Response) => new Error(`HTTP error! status: ${response.status}`);

/** Error codes of a 400 ValidationProblem (keyed by code, like Identity's own errors). */
async function readErrors(response: Response): Promise<Record<string, string[]>> {
  const problem: ValidationProblem | null = await response.json().catch(() => null);
  return problem?.errors ?? {};
}

/** Changes the password; other sessions end, this one stays signed in. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  const response = await apiFetch('/api/account/password', postJson({ currentPassword, newPassword }));
  if (response.ok) return { ok: true };
  if (response.status === 400) {
    const errors = await readErrors(response);
    if ('LockedOut' in errors) return { ok: false, code: 'lockedOut', errors: [] };
    if ('PasswordMismatch' in errors) return { ok: false, code: 'wrongPassword', errors: [] };
    return { ok: false, code: 'rules', errors: Object.values(errors).flat() };
  }
  throw unexpected(response);
}

/** Ends every other session of this account; this browser stays signed in. */
export async function signOutOtherDevices(): Promise<void> {
  const response = await apiFetch('/api/account/sign-out-others', postJson());
  if (!response.ok) throw unexpected(response);
}

/** Deletes the account for good; the server ends the session. */
export async function deleteAccount(password: string, email: string): Promise<DeleteAccountResult> {
  const response = await apiFetch('/api/account/delete', postJson({ password, email }));
  if (response.ok) return { ok: true };
  if (response.status === 400) {
    const errors = await readErrors(response);
    if ('LockedOut' in errors) return { ok: false, code: 'lockedOut' };
    if ('PasswordMismatch' in errors) return { ok: false, code: 'wrongPassword' };
    if ('EmailMismatch' in errors) return { ok: false, code: 'emailMismatch' };
  }
  throw unexpected(response);
}
