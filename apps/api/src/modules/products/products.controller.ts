import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
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
}
