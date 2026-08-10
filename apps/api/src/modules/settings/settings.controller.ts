import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SetupDto } from './dto/setup.dto';
import { SettingsService } from './settings.service';

@ApiTags('setup')
@Controller('setup')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('status')
  @ApiOkResponse({
    description: 'Server-side onboarding and Telegram status.',
    schema: {
      example: {
        required: true,
        completedAt: null,
        defaultCheckIntervalSeconds: 86400,
        telegram: { configured: false, status: 'not_configured' },
      },
    },
  })
  status() {
    return this.settingsService.status();
  }

  @Post()
  @ApiCreatedResponse({
    description: 'Partial-success onboarding result.',
    schema: {
      example: {
        completed: true,
        completedAt: '2026-08-10T12:00:00Z',
        created: [{ id: 'uuid', url: 'https://shop.example/product', status: 'ACTIVE' }],
        failed: [
          {
            url: 'https://other.example/product',
            code: 'WATCH_CREATE_FAILED',
            message: 'Takip başlatılamadı.',
          },
        ],
      },
    },
  })
  setup(@Body() input: SetupDto) {
    return this.settingsService.setup(input);
  }
}
