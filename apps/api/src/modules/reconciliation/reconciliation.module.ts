import { Module } from '@nestjs/common';
import { ChangedetectionModule } from '../changedetection/changedetection.module';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [ChangedetectionModule],
  providers: [ReconciliationService],
})
export class ReconciliationModule {}
