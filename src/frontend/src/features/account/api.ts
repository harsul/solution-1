import { apiFetch } from '../../api/apiFetch';

export type ChangePasswordResult = { ok: true } | { ok: false; code: 'wrongPassword' | 'rules'; errors: string[] };

export type ChangeEmailResult = { ok: true } | { ok: false; code: 'invalidEmail' };

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

/** Changes the password through Identity's built-in endpoint; the caller signs this browser out afterwards. */
export async function changePassword(oldPassword: string, newPassword: string): Promise<ChangePasswordResult> {
  const response = await apiFetch('/api/auth/manage/info', postJson({ oldPassword, newPassword }));
  if (response.ok) return { ok: true };
  if (response.status === 400) {
    const errors = await readErrors(response);
    if ('PasswordMismatch' in errors) return { ok: false, code: 'wrongPassword', errors: [] };
    return { ok: false, code: 'rules', errors: Object.values(errors).flat() };
  }
  throw unexpected(response);
}

/** Sends a confirmation link to the new address; the email changes only when it is opened. */
export async function changeEmail(newEmail: string): Promise<ChangeEmailResult> {
  const response = await apiFetch('/api/auth/manage/info', postJson({ newEmail }));
  if (response.ok) return { ok: true };
  if (response.status === 400 && 'InvalidEmail' in (await readErrors(response))) {
    return { ok: false, code: 'invalidEmail' };
  }
  throw unexpected(response);
}
