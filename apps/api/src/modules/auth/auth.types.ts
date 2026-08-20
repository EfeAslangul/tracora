import type { User } from '@prisma/client';
import type { IncomingMessage } from 'node:http';

export type AuthenticatedUser = User;

export interface AuthenticatedRequest extends IncomingMessage {
  user?: AuthenticatedUser;
}
