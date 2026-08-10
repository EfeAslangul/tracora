import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const booleanValue = (value: unknown): unknown => {
  if (value === true || value === 'true' || value === 'True') return true;
  if (value === false || value === 'false' || value === 'False') return false;
  if (value === '' || value === 'None' || value === null) return undefined;
  return value;
};

export class PriceStockObservationDto {
  @ApiProperty({ example: '1999.90' })
  @IsString()
  @Matches(/^\d{1,14}(?:\.\d{1,4})?$/)
  price!: string;

  @ApiProperty({ example: 'TRY' })
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => booleanValue(value))
  @IsBoolean()
  inStock?: boolean;
}

export class ChangedetectionObservationDto {
  @ApiProperty({ example: 1 })
  @Equals(1)
  schemaVersion!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  eventId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  watchId!: string;

  @ApiProperty({ description: 'Unix epoch seconds.' })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(1)
  observedAt!: number;

  @ApiProperty({ type: PriceStockObservationDto })
  @ValidateNested()
  @Type(() => PriceStockObservationDto)
  observation!: PriceStockObservationDto;
}
