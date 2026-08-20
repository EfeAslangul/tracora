import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Length(1, 200)
  displayName?: string | null;

  @ApiPropertyOptional({
    description: 'Telegram chat id. null gönderilirse bildirimler kapanır.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Matches(/^-?\d{1,32}$/, { message: 'telegramChatId sayısal bir Telegram chat kimliği olmalı.' })
  telegramChatId?: string | null;
}
