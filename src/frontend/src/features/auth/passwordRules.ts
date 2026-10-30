/** Password rules shown while typing; the server enforces the same rules (IdentitySetup). */
export const passwordRules = [
  { id: 'minLength', label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { id: 'hasLetter', label: 'At least one letter', test: (pw: string) => /\p{L}/u.test(pw) },
  { id: 'hasDigit', label: 'At least one number', test: (pw: string) => /\d/.test(pw) },
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
