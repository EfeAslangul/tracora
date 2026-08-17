import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { logJson } from './log';

interface RouteRequest {
  method: string;
  route?: { path?: string };
  path?: string;
}

interface StatusResponse {
  statusCode?: number;
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Http');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<RouteRequest>();
    const response = http.getResponse<StatusResponse>();
    const startedAt = Date.now();
    // Ham URL değil, eşleşen rota kalıbı loglanır: id ve query değerleri sızmaz.
    const route = request.route?.path ?? 'unmatched';

    const write = (status: number): void => {
      logJson(this.logger, status >= 500 ? 'error' : 'log', 'http_request', {
        method: request.method,
        route,
        status,
        durationMs: Date.now() - startedAt,
      });
    };

    return next.handle().pipe(
      tap({
        next: () => write(response.statusCode ?? HttpStatus.OK),
        error: (error: unknown) =>
          write(
            error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
          ),
      }),
    );
  }
}
