import type { Logger } from '@nestjs/common';
import { getRequestContext } from './request-context';

type LogLevel = 'log' | 'warn' | 'error' | 'debug';

/**
 * Tek satırlık yapılandırılmış log. Yalnız buraya açıkça verilen alanlar yazılır;
 * istek/yanıt gövdeleri, header'lar ve secret'lar asla loglanmaz.
 */
export const logJson = (
  logger: Logger,
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void => {
  const context = getRequestContext();
  logger[level](
    JSON.stringify({
      event,
      ...(context?.requestId ? { requestId: context.requestId } : {}),
      ...(context?.source ? { source: context.source } : {}),
      ...fields,
    }),
  );
};
