import { describe, expect, it, vi } from 'vitest';
import { apiFetch, setUnauthorizedHandler } from './apiFetch';

const respondWith = (status: number) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status })),
  );

describe('apiFetch', () => {
  it('reports a 401 to the current handler', async () => {
    const handler = vi.fn();
    const unsubscribe = setUnauthorizedHandler(handler);
    respondWith(401);

    await apiFetch('/api/anything');

    expect(handler).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('does not report other statuses', async () => {
    const handler = vi.fn();
    const unsubscribe = setUnauthorizedHandler(handler);
    respondWith(500);

    await apiFetch('/api/anything');

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('a late unsubscribe of an old handler keeps the newer one', async () => {
    const oldHandler = vi.fn();
    const newHandler = vi.fn();
    const unsubscribeOld = setUnauthorizedHandler(oldHandler);
    const unsubscribeNew = setUnauthorizedHandler(newHandler);
    unsubscribeOld();
    respondWith(401);

    await apiFetch('/api/anything');

    expect(newHandler).toHaveBeenCalledOnce();
    expect(oldHandler).not.toHaveBeenCalled();
    unsubscribeNew();
  });
});
