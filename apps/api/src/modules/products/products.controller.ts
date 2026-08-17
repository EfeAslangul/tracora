import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DomainThrottlerGuard } from '../../common/throttling/domain-throttler.guard';
import {
  ApiAcceptedResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { uuidParam } from '../../common/pipes/uuid-param.pipe';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOkResponse({
    description: 'Paginated product list.',
    schema: {
      example: {
        items: [
          {
            id: 'uuid',
            name: 'Example product',
            url: 'https://shop.example/product',
            hostname: 'shop.example',
            profile: 'generic',
            status: 'ACTIVE',
            currentPrice: 1999.9,
            previousPrice: 2299.9,
            currency: 'TRY',
            targetPrice: 1799.9,
            inStock: true,
            lastSuccessfulCheckAt: '2026-08-10T12:00:00Z',
            lastError: null,
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    },
  })
  list(@Query() query: ListProductsQueryDto) {
    return this.productsService.list(query);
  }

  @Post()
  @ApiCreatedResponse({
    description: 'Product watch created and initial check accepted.',
    schema: {
      example: {
        id: 'uuid',
        url: 'https://shop.example/product',
        hostname: 'shop.example',
        profile: 'generic',
        status: 'ACTIVE',
        currentPrice: null,
        targetPrice: 1799.9,
      },
    },
  })
  create(@Body() input: CreateProductDto) {
    return this.productsService.create(input);
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Product detail with price history, stock history and recent events.',
    schema: {
      example: {
        id: 'uuid',
        name: 'Example product',
        url: 'https://shop.example/product',
        hostname: 'shop.example',
        status: 'ACTIVE',
        currentPrice: 1999.9,
        previousPrice: 2299.9,
        currency: 'TRY',
        targetPrice: 1799.9,
        inStock: true,
        watchId: 'watch-uuid',
        fetchMode: 'HTTP',
        priceHistory: [{ price: 2299.9, currency: 'TRY', observedAt: '2026-08-09T12:00:00Z' }],
        stockHistory: [{ inStock: true, observedAt: '2026-08-09T12:00:00Z' }],
        recentEvents: [
          {
            type: 'EXTRACTION_ERROR',
            code: 'EXTRACTION_UNSUPPORTED',
            message: 'Genel profil bu ürün sayfasından fiyat çıkaramadı.',
            createdAt: '2026-08-09T12:00:00Z',
          },
        ],
      },
    },
  })
  detail(@Param('id', uuidParam()) id: string) {
    return this.productsService.detail(id);
  }

  @Patch(':id')
  @ApiOkResponse({
    description: 'Updated product. PAUSED is also applied on the changedetection.io watch.',
  })
  update(@Param('id', uuidParam()) id: string, @Body() input: UpdateProductDto) {
    return this.productsService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Watch and product removed. No soft delete.' })
  remove(@Param('id', uuidParam()) id: string): Promise<void> {
    return this.productsService.remove(id);
  }

  @Post(':id/check')
  @UseGuards(DomainThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: 'Manual check triggered. The result arrives asynchronously via webhook.',
    schema: { example: { accepted: true, triggeredAt: '2026-08-10T12:00:00Z' } },
  })
  check(@Param('id', uuidParam()) id: string) {
    return this.productsService.check(id);
  }

  @Post(':id/retry')
  @ApiOkResponse({ description: 'Watch creation retried for a FAILED product.' })
  retry(@Param('id', uuidParam()) id: string) {
    return this.productsService.retry(id);
  }
}
