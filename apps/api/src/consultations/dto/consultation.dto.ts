import { IsString, IsEnum, IsOptional, IsNumber, ValidateNested, IsBoolean, Matches, Equals, MaxLength, MinLength, IsNotEmpty, IsArray, ArrayNotEmpty, ArrayMaxSize, IsUUID } from 'class-validator';

import { Type } from 'class-transformer';

import { ApiProperty } from '@nestjs/swagger';



export class CreateClinicalRecordDto {

  @ApiProperty()

  @IsString()

  complaints: string;



  @ApiProperty()

  @IsString()

  anamnesisMorbi: string;



  @ApiProperty()

  @IsString()

  anamnesisVitae: string;



  @ApiProperty({ required: false })

  @IsOptional()

  @IsString()

  medications?: string;



  @ApiProperty({ required: false })

  @IsOptional()

  @IsString()

  allergies?: string;



  @ApiProperty({ required: false })

  @IsOptional()

  @IsNumber()

  weight?: number;



  @ApiProperty({ required: false })

  @IsOptional()

  @IsNumber()

  height?: number;



  @ApiProperty({ required: false })

  @IsOptional()

  vitalSigns?: Record<string, unknown>;



  @ApiProperty({ required: false })

  @IsOptional()

  @IsString()

  familyHistory?: string;



  @ApiProperty({ required: false })

  @IsOptional()

  @IsString()

  socialHistory?: string;



  @ApiProperty({ required: false })

  @IsOptional()

  @IsString()

  labResults?: string;

}



export class CreateConsultationDto {

  @ApiProperty()

  @IsString()

  patientId: string;



  @ApiProperty()

  @ValidateNested()

  @Type(() => CreateClinicalRecordDto)

  clinicalRecord: CreateClinicalRecordDto;



  @ApiProperty({ description: 'Bemor roziligi majburiy' })

  @IsBoolean()

  @Equals(true, { message: 'Bemor roziligi talab qilinadi' })

  consentGiven: boolean;

  @ApiProperty({ required: false, description: 'Offline sync idempotency kaliti' })
  @IsOptional()
  @IsString()
  clientRequestId?: string;

  @ApiProperty({ required: false, description: 'Klinik checklist JSON' })
  @IsOptional()
  checklistData?: Array<{ id: string; label: string; required: boolean; checked: boolean; notes?: string }>;

  @ApiProperty({ description: 'Tanlangan shifokor (majburiy — navbat shu shifokorga)' })
  @IsString()
  @IsNotEmpty({ message: 'Shifokor tanlash majburiy' })
  mtDoctorId: string;
}



export class FinalDiagnosisDto {

  @ApiProperty({ required: false })

  @IsOptional()

  @IsString()

  diagnosis?: string;



  @ApiProperty({ example: 'J06.9', required: false })

  @IsOptional()

  @IsString()

  @Matches(/^[A-Z][0-9]{2}(\.[0-9]{1,2})?$/, { message: 'ICD-10 kodi noto\'g\'ri formatda' })

  icd10Code?: string;



  @ApiProperty({ required: false })

  @IsOptional()

  @IsString()

  recommendations?: string;



  @ApiProperty({ required: false })

  @IsOptional()

  @IsString()

  prescription?: string;



  @ApiProperty({ required: false })

  @IsOptional()

  @IsString()

  notes?: string;

}



export enum AiFeedbackRating {

  HELPFUL = 'HELPFUL',

  NEUTRAL = 'NEUTRAL',

  HARMFUL = 'HARMFUL',

}



export class AiFeedbackDto {

  @ApiProperty({ enum: AiFeedbackRating })

  @IsEnum(AiFeedbackRating)

  rating: AiFeedbackRating;



  @ApiProperty({ required: false })

  @IsOptional()

  @IsString()

  comment?: string;

}



export class CancelConsultationDto {
  @ApiProperty({ description: 'Bekor qilish sababi (majburiy)' })
  @IsString()
  @IsNotEmpty({ message: 'Bekor qilish sababi kiritilishi shart' })
  @MinLength(3, { message: 'Sabab kamida 3 ta belgidan iborat bo\'lishi kerak' })
  @MaxLength(1000)
  reason: string;
}

export class SecondOpinionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  question: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assignedDoctorId?: string;
}

export class SecondOpinionResponseDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  response: string;
}

export class EscalateConsultationDto {
  @ApiProperty({ enum: ['SENIOR_REVIEW', 'EMERGENCY'] })
  @IsString()
  level: 'SENIOR_REVIEW' | 'EMERGENCY';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ConfirmAiStepDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}




/** Konsiliumga qo'shiladigan qo'shimcha shifokorlar */
export class AddParticipantsDto {
  @ApiProperty({ type: [String], description: 'Shifokorlar ID ro\'yxati' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  doctorIds: string[];
}
