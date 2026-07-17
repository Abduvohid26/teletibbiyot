import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TriageLevel } from '@prisma/client';

export class UpdateTriageDto {
  @ApiProperty({ enum: TriageLevel })
  @IsEnum(TriageLevel)
  triageLevel: TriageLevel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  triageNotes?: string;
}

export class UpdatePriorityDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100)
  priority: number;
}

export class UpdateClinicalNotesDto {
  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  clinicalNotes: string;
}

export class UpdateFollowUpDto {
  @ApiProperty()
  @IsString()
  followUpDate: string;
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  @Min(1)
  @MaxLength(2000)
  message: string;
}

export class AiChatDto {
  @ApiProperty()
  @IsString()
  @Min(1)
  @MaxLength(2000)
  question: string;
}

export class ReadMonitorVitalsDto {
  @ApiProperty({ description: 'Base64 JPEG/PNG (data URL yoki xom base64)' })
  @IsString()
  @MinLength(10)
  image: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @Min(8)
  @MaxLength(128)
  password: string;
}
