import { HttpException } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: number,
    public readonly details: Record<string, unknown> = {},
  ) {
    super({ code, message, details }, status);
  }
}
