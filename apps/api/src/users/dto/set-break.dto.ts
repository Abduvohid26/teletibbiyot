import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetBreakDto {
  @ApiProperty({ description: 'true — tanaffusga chiqish, false — ishga qaytish' })
  @IsBoolean()
  onBreak!: boolean;
}
