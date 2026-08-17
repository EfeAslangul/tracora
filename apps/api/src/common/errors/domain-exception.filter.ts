import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { getRequestId } from '../logging/request-context';
import { logJson } from '../logging/log';

interface HttpRequest {
  header(name: string): string | undefined;
  method: string;
  path: string;
}

interface HttpResponse {
  setHeader(name: string, value: string): void;
  status(code: number): HttpResponse;
  json(body: unknown): void;
}

interface ErrorBody {
  code?: string;
  message?: string | string[];
  details?: Record<string, unknown>;
}

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequest>();
    const response = context.getResponse<HttpResponse>();
    // Middleware normalde context'i kurar; filtre DI'sız kurulduğu için ALS'e
    // doğrudan bakar ve middleware'in çalışmadığı durumlarda header'a düşer.
    const requestId =
      getRequestId() || request.header('x-request-id')?.slice(0, 100) || randomUUID();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = this.toBody(exception, status);

    if (status >= 500) {
      logJson(this.logger, 'error', 'request_failed', {
        requestId,
        method: request.method,
        status,
      });
    }

    response.setHeader('x-request-id', requestId);
    response.status(status).json({
      code: body.code ?? (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'),
      message: this.message(body.message, status),
      details: body.details ?? {},
      requestId,
    });
  }

  private toBody(exception: unknown, status: number): ErrorBody {
    if (!(exception instanceof HttpException)) return {};
    const response = exception.getResponse();
    if (typeof response === 'string') return { message: response };
    if (typeof response === 'object' && response !== null) return response as ErrorBody;
    return { code: status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED' };
  }

  private message(message: string | string[] | undefined, status: number): string {
    if (status === 500) return 'Beklenmeyen bir sunucu hatası oluştu.';
    if (Array.isArray(message)) return message.join(' ');
    return message ?? 'İstek tamamlanamadı.';
  }
}
