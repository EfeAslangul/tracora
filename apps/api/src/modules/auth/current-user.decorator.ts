import { HttpStatus, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { DomainException } from '../../common/errors/domain.exception';
import type { AuthenticatedRequest, AuthenticatedUser } from './auth.types';

/**
 * Guard her auth'lu istekte request.user'ı doldurur; burada eksik olması
 * @Public() ile korumasız bırakılmış bir uçta kullanıldığı anlamına gelir.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new DomainException(
        'UNAUTHENTICATED',
        'Bu işlem için oturum açmanız gerekiyor.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return request.user;
  },
);
