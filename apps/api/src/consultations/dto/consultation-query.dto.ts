import { IsOptional, IsString, IsEnum, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConsultationStatus, TriageLevel } from '@prisma/client';

export class ConsultationQueryDto {
  @ApiPropertyOptional({ description: 'Bemor ismi bo\'yicha qidirish' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ConsultationStatus })
  @IsOptional()
  @IsEnum(ConsultationStatus)
  status?: ConsultationStatus;

  @ApiPropertyOptional({ enum: TriageLevel })
  @IsOptional()
  @IsEnum(TriageLevel)
  triageLevel?: TriageLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: "Bemorning tug'ilgan sanasi (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({
    description: "'due' — nazorat sanasi belgilangan konsultatsiyalar, sanasi yaqinlari tepada",
  })
  @IsOptional()
  @IsString()
  followUp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hasAiAnalysis?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
