import { Module } from '@nestjs/common';
import { ChangedetectionHttpClient } from './changedetection-http.client';
import { CHANGEDETECTION_CLIENT } from './changedetection.types';

@Module({
  providers: [{ provide: CHANGEDETECTION_CLIENT, useClass: ChangedetectionHttpClient }],
  exports: [CHANGEDETECTION_CLIENT],
})
export class ChangedetectionModule {}
