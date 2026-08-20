import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:public';

/**
 * Global FirebaseAuthGuard'ı atlayan uç noktalar. Yalnız kendi doğrulamasını
 * taşıyan (webhook secret) ya da hiç veri döndürmeyen uçlar için kullanılır.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
