import { Module } from '@nestjs/common';
import { ChangedetectionModule } from '../changedetection/changedetection.module';
import { SitesModule } from '../sites/sites.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [ChangedetectionModule, SitesModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
