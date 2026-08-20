import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ProductsModule } from '../products/products.module';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

/**
 * Guard global olarak bağlanır: yeni bir uç nokta eklendiğinde varsayılan
 * korumalıdır, açmak için bilinçli olarak @Public() yazmak gerekir.
 */
@Global()
@Module({
  imports: [ProductsModule],
  controllers: [MeController],
  providers: [
    FirebaseAdminService,
    UsersService,
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
  ],
  exports: [FirebaseAdminService, UsersService],
})
export class AuthModule {}
