import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as api from './api';
import { AuthContext, type AuthContextValue, type AuthState } from './AuthContext';

/** Loads the current session on start and keeps the signed-in state for the whole app. */
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  // Only the newest session check may update the state; an older one finishing late
  // (e.g. the check on page load, after a sign-in) must not overwrite it.
  const latestCheck = useRef(0);

  const loadUser = useCallback(async () => {
    const check = ++latestCheck.current;
    let next: AuthState;
    try {
      const user = await api.getUserInfo();
      next = user ? { status: 'signedIn', email: user.email } : { status: 'signedOut' };
    } catch {
      next = { status: 'signedOut' };
    }
    if (check === latestCheck.current) setState(next);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (credentials, rememberMe) => {
      const result = await api.signIn(credentials, rememberMe);
      if (result === 'ok') await loadUser();
      return result;
    },
    [loadUser],
  );

  const register = useCallback<AuthContextValue['register']>(
    async (credentials) => {
      const result = await api.register(credentials);
      if (!result.ok) return result;
      try {
        return { ok: true, signedIn: (await signIn(credentials, false)) === 'ok' };
      } catch {
        return { ok: true, signedIn: false };
      }
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    await api.signOut();
    latestCheck.current++;
    setState({ status: 'signedOut' });
  }, []);

  const value = useMemo(() => ({ state, signIn, register, signOut }), [state, signIn, register, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
