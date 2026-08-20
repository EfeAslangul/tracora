import type { DecodedIdToken } from 'firebase-admin/auth';
import type { PrismaService } from '../database/prisma.service';
import type { ProductsService } from '../products/products.service';
import { UsersService } from './users.service';

const decoded = (overrides: Partial<DecodedIdToken> = {}) =>
  ({
    uid: 'uid-1',
    email: 'user@example.com',
    email_verified: true,
    name: 'Token Name',
    firebase: { sign_in_provider: 'password' },
    ...overrides,
  }) as DecodedIdToken;

describe('UsersService', () => {
  const prisma = {
    user: { upsert: jest.fn(), update: jest.fn(), delete: jest.fn() },
    product: { findMany: jest.fn() },
  };
  const products = { remove: jest.fn() };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    products as unknown as ProductsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.upsert.mockResolvedValue({ id: 'user-1' });
    prisma.product.findMany.mockResolvedValue([]);
  });

  it('creates the local row on first sight and refreshes it afterwards', async () => {
    await service.provision(decoded());

    const call = prisma.user.upsert.mock.calls[0][0] as {
      where: { firebaseUid: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(call.where).toEqual({ firebaseUid: 'uid-1' });
    expect(call.create).toMatchObject({ displayName: 'Token Name', signInProvider: 'password' });
    // Kullanıcının PATCH /me ile verdiği ad her istekte token tarafından ezilmemeli.
    expect(call.update).not.toHaveProperty('displayName');
  });

  it('hides the raw telegram chat id behind a boolean', async () => {
    const profile = await service.profile({
      id: 'user-1',
      email: 'user@example.com',
      emailVerified: true,
      displayName: null,
      signInProvider: 'password',
      telegramChatId: '4242',
      onboardingCompletedAt: null,
    } as never);

    expect(profile.telegram).toEqual({ configured: true });
    expect(profile).not.toHaveProperty('telegramChatId');
  });

  it('rejects an update with no fields', async () => {
    await expect(service.updateProfile('user-1', {})).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    });
  });

  it('removes every owned product before deleting the account', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 'product-1' }, { id: 'product-2' }]);

    await service.deleteAccount('user-1');

    expect(products.remove).toHaveBeenCalledWith('user-1', 'product-1');
    expect(products.remove).toHaveBeenCalledWith('user-1', 'product-2');
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    expect(products.remove.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.user.delete.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
});
