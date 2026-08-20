import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';
import type { AuthenticatedUser } from './auth.types';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOkResponse({
    description: 'Signed-in user profile.',
    schema: {
      example: {
        id: 'uuid',
        email: 'user@example.com',
        emailVerified: true,
        displayName: 'Efe',
        signInProvider: 'password',
        onboarding: { completedAt: '2026-08-18T12:00:00Z' },
        telegram: { configured: true },
      },
    },
  })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.profile(user);
  }

  @Patch()
  @ApiOkResponse({ description: 'Updated profile.' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdateMeDto) {
    return this.usersService.updateProfile(user.id, input);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'Account and all owned products removed. The Firebase account is deleted by the client.',
  })
  remove(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.usersService.deleteAccount(user.id);
  }
}
