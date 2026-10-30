type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Registered by AuthProvider: a 401 from the API means the session is gone (e.g. expired).
 * Returns an unsubscribe function that only removes this handler if it is still the current one,
 * so an old provider cleaning up late can't disconnect a newer one.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  onUnauthorized = handler;
  return () => {
    if (onUnauthorized === handler) onUnauthorized = null;
  };
}

/** `fetch` for app API calls (not the auth endpoints): reports 401 responses to the auth state. */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) onUnauthorized?.();
  return response;
}
