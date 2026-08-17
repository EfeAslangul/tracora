import { HttpStatus, ParseUUIDPipe } from '@nestjs/common';
import { DomainException } from '../errors/domain.exception';

export const uuidParam = (): ParseUUIDPipe =>
  new ParseUUIDPipe({
    version: '4',
    exceptionFactory: () =>
      new DomainException('INVALID_REQUEST', 'Ürün kimliği geçerli değil.', HttpStatus.BAD_REQUEST),
  });
