import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class AishifokorReferralPushDto {
  @IsString()
  @MinLength(8)
  correlation_id!: string;

  @IsString()
  @MinLength(8)
  handoff_token!: string;

  @IsOptional()
  @IsString()
  handoff_url?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
