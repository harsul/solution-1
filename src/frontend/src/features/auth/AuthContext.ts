import { createContext, useContext } from 'react';
import type { Credentials, RegisterResult, SignInResult } from './api';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; reason?: 'expired' }
  | { status: 'signedIn'; email: string; emailConfirmed: boolean };

/** Registration result; `signedIn` is false when the account was created but the automatic sign-in failed. */
export type RegisterOutcome = { ok: true; signedIn: boolean } | Extract<RegisterResult, { ok: false }>;

export interface AuthContextValue {
  state: AuthState;
  signIn: (credentials: Credentials, rememberMe: boolean) => Promise<SignInResult>;
  /** Registers and, on success, signs the new user in (session cookie). */
  register: (credentials: Credentials) => Promise<RegisterOutcome>;
  signOut: () => Promise<void>;
  /** Reloads the session state (e.g. after confirming the email); resolves to whether signed in. */
  refreshUser: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
