import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [ProductsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
