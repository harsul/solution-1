/** Password rules shown while typing: Identity's defaults, which the server enforces. ASCII only, like Identity. */
export const passwordRules = [
  { id: 'minLength', label: 'At least 6 characters', test: (pw: string) => pw.length >= 6 },
  { id: 'hasLower', label: 'A lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
  { id: 'hasUpper', label: 'An uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { id: 'hasDigit', label: 'A number', test: (pw: string) => /[0-9]/.test(pw) },
  { id: 'hasSymbol', label: 'A symbol (e.g. ! or #)', test: (pw: string) => /[^a-zA-Z0-9]/.test(pw) },
] as const;

export type PasswordRuleId = (typeof passwordRules)[number]['id'];

export function checkPassword(password: string): Record<PasswordRuleId, boolean> {
  return Object.fromEntries(passwordRules.map((rule) => [rule.id, rule.test(password)])) as Record<
    PasswordRuleId,
    boolean
  >;
}

export function isPasswordValid(password: string): boolean {
  return passwordRules.every((rule) => rule.test(password));
}

/** A light check for obvious typos; the server does the real validation. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Identity's default `AllowedUserNameCharacters`: the email is also the sign-in name, so it must only use these. */
export function isUsableAsSignInName(email: string): boolean {
  return /^[a-zA-Z0-9\-._@+]+$/.test(email);
}
