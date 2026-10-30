import { apiFetch } from '../../api/apiFetch';

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; code: 'wrongPassword' | 'lockedOut' | 'rules'; errors: string[] };

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; code: 'wrongPassword' | 'lockedOut' | 'emailMismatch' };

export type ChangeEmailResult =
  | { ok: true }
  | { ok: false; code: 'wrongPassword' | 'lockedOut' | 'invalidEmail' | 'sameEmail' | 'inUse' | 'tooManyRequests' };

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

const changeEmailCodes = {
  LockedOut: 'lockedOut',
  PasswordMismatch: 'wrongPassword',
  InvalidEmail: 'invalidEmail',
  SameEmail: 'sameEmail',
  DuplicateEmail: 'inUse',
} as const;

/** Sends a confirmation link to the new address; the email changes only when it is opened. */
export async function changeEmail(newEmail: string, password: string): Promise<ChangeEmailResult> {
  const response = await apiFetch('/api/account/email', postJson({ newEmail, password }));
  if (response.ok) return { ok: true };
  if (response.status === 429) return { ok: false, code: 'tooManyRequests' };
  if (response.status === 400) {
    const errors = await readErrors(response);
    const known = (Object.keys(changeEmailCodes) as (keyof typeof changeEmailCodes)[]).find((code) => code in errors);
    if (known) return { ok: false, code: changeEmailCodes[known] };
  }
  throw unexpected(response);
}

export type ConfirmEmailChangeResult = 'changed' | 'invalid' | 'inUse';

/** Applies a change-email link. Works signed in or not. */
export async function confirmEmailChange(userId: string, email: string, code: string): Promise<ConfirmEmailChangeResult> {
  const response = await apiFetch('/api/account/email/confirm', postJson({ userId, email, code }));
  if (response.ok) return 'changed';
  if (response.status === 400) {
    const errors = await readErrors(response);
    return 'DuplicateEmail' in errors ? 'inUse' : 'invalid';
  }
  throw unexpected(response);
}
