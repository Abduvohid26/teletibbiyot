import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyticsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utId?: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @ApiPropertyOptional({ enum: ['7d', '30d', '90d'] })
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  period?: '7d' | '30d' | '90d';
}

export class GlobalSearchDto {
  @ApiPropertyOptional()
  @IsString()
  q: string;
}
