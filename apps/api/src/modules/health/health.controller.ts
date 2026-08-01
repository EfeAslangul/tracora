import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'Application liveness endpoint.' })
  getHealth() {
    return { status: 'ok', version: '0.1.0' };
  }
}
