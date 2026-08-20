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
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { uuidParam } from '../../common/pipes/uuid-param.pipe';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth()
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
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListProductsQueryDto) {
    return this.productsService.list(user.id, query);
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
  create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateProductDto) {
    return this.productsService.create(user.id, input);
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
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id', uuidParam()) id: string) {
    return this.productsService.detail(user.id, id);
  }

  @Patch(':id')
  @ApiOkResponse({
    description: 'Updated product. PAUSED is also applied on the changedetection.io watch.',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam()) id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.productsService.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Watch and product removed. No soft delete.' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam()) id: string,
  ): Promise<void> {
    return this.productsService.remove(user.id, id);
  }

  @Post(':id/check')
  @UseGuards(DomainThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: 'Manual check triggered. The result arrives asynchronously via webhook.',
    schema: { example: { accepted: true, triggeredAt: '2026-08-10T12:00:00Z' } },
  })
  check(@CurrentUser() user: AuthenticatedUser, @Param('id', uuidParam()) id: string) {
    return this.productsService.check(user.id, id);
  }

  @Post(':id/retry')
  @ApiOkResponse({ description: 'Watch creation retried for a FAILED product.' })
  retry(@CurrentUser() user: AuthenticatedUser, @Param('id', uuidParam()) id: string) {
    return this.productsService.retry(user.id, id);
  }
}
