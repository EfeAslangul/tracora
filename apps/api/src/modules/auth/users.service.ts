import { HttpStatus, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { DomainException } from '../../common/errors/domain.exception';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import type { UpdateMeDto } from './dto/update-me.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * Ayrı bir kayıt ucu yok: hesap Firebase'de açılır, ilk auth'lu istek yerel
   * kaydı doğurur. displayName yalnız oluşturmada token'dan alınır; sonradan
   * PATCH /me ile verilen ad her istekte token tarafından ezilmemeli.
   */
  async provision(decoded: DecodedIdToken): Promise<User> {
    const email = decoded.email ?? null;
    const emailVerified = decoded.email_verified ?? false;
    const signInProvider = decoded.firebase?.sign_in_provider ?? null;
    const displayName = typeof decoded.name === 'string' ? decoded.name : null;

    return this.prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      create: {
        firebaseUid: decoded.uid,
        email,
        emailVerified,
        displayName,
        signInProvider,
        lastSeenAt: new Date(),
      },
      update: { email, emailVerified, signInProvider, lastSeenAt: new Date() },
    });
  }

  async profile(user: User) {
    return this.present(user);
  }

  async updateProfile(userId: string, input: UpdateMeDto) {
    if (input.displayName === undefined && input.telegramChatId === undefined) {
      throw new DomainException(
        'INVALID_REQUEST',
        'Güncellenecek en az bir alan gönderilmelidir.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: input.displayName === undefined ? undefined : input.displayName,
        telegramChatId: input.telegramChatId === undefined ? undefined : input.telegramChatId,
      },
    });
    return this.present(updated);
  }

  /**
   * Hesap silme App Store 5.1.1(v) gereği uygulama içinden yapılabilmeli.
   * Ürünler tek tek silinir: paylaşılan watch'ın uzak tarafta ne zaman
   * kaldırılacağına ProductsService.remove karar verir. Firebase tarafındaki
   * hesabı istemci kendi siler.
   */
  async deleteAccount(userId: string): Promise<void> {
    const products = await this.prisma.product.findMany({
      where: { userId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    for (const product of products) {
      await this.productsService.remove(userId, product.id);
    }
    await this.prisma.user.delete({ where: { id: userId } });
  }

  // telegramChatId ham olarak dışarı verilmez; istemcinin ihtiyacı olan tek
  // bilgi bildirimlerin gidebilir durumda olup olmadığı.
  private present(user: User) {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      signInProvider: user.signInProvider,
      onboarding: { completedAt: user.onboardingCompletedAt },
      telegram: { configured: user.telegramChatId !== null },
    };
  }
}
