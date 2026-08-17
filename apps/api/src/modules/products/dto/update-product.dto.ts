import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import { IsBoolean, IsIn, IsNumber, IsOptional, Min, ValidateIf } from 'class-validator';

export type UpdatableProductStatus = typeof ProductStatus.ACTIVE | typeof ProductStatus.PAUSED;

export class UpdateProductDto {
  @ApiPropertyOptional({
    example: 1799.9,
    nullable: true,
    description: 'null hedef fiyatı temizler.',
  })
  @IsOptional()
  @ValidateIf((dto: UpdateProductDto) => dto.targetPrice !== null)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  targetPrice?: number | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @ApiPropertyOptional({ enum: [ProductStatus.ACTIVE, ProductStatus.PAUSED] })
  @IsOptional()
  @IsIn([ProductStatus.ACTIVE, ProductStatus.PAUSED])
  status?: UpdatableProductStatus;
}
