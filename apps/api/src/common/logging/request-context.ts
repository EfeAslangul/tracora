import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  /** HTTP isteği için tanımsız; arka plan işleri için worker adı. */
  source?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithContext = <T>(context: RequestContext, callback: () => T): T =>
  storage.run(context, callback);

export const getRequestContext = (): RequestContext | undefined => storage.getStore();

export const getRequestId = (): string | undefined => storage.getStore()?.requestId;
