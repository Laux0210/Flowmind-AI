'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicResource } from '@flowmind/contracts';
import { ApiClient } from './api-client';

export interface ResourceCatalogState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  resources: readonly PublicResource[];
  error: string | null;
}

export function useResourceCatalog(context: object | null, getToken: () => Promise<string | null>): ResourceCatalogState {
  const currentContext = useRef(context);
  currentContext.current = context;
  const generation = useRef(0);
  const [result, setResult] = useState<ResourceCatalogState & { context: object | null }>({
    context: null, status: 'idle', resources: [], error: null,
  });

  useEffect(() => {
    const requestId = ++generation.current;
    let cancelled = false;
    const current = () => !cancelled && generation.current === requestId && currentContext.current === context;
    if (!context) {
      setResult({ context, status: 'idle', resources: [], error: null });
      return () => { cancelled = true; };
    }
    setResult({ context, status: 'loading', resources: [], error: null });
    void (async () => {
      try {
        const token = await getToken();
        if (!current()) return;
        const resources = await ApiClient.listResources(token);
        if (!current()) return;
        setResult({ context, status: 'ready', resources, error: null });
      } catch {
        if (current()) setResult({
          context, status: 'error', resources: [],
          error: 'Não foi possível carregar os recursos. Atualize a página para tentar novamente.',
        });
      }
    })();
    return () => { cancelled = true; };
  }, [context, getToken]);

  return result.context === context ? result
    : { status: context ? 'loading' : 'idle', resources: [], error: null };
}
