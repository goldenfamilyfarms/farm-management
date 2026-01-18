import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateHarvestDto {
  @IsUUID()
  fieldId!: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsUUID()
  plantingId?: string;

  @IsString()
  @MaxLength(100)
  cropType!: string;

  @IsNumber()
  @Min(0.01, { message: 'quantity must be greater than 0' })
  quantity!: number;

  @IsString()
  @MaxLength(20)
  unit!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  qualityGrade?: string;

  @IsDateString()
  harvestDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateHarvestDto {
  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @IsOptional()
  @IsUUID()
  plantingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cropType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01, { message: 'quantity must be greater than 0' })
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  qualityGrade?: string;

  @IsOptional()
  @IsDateString()
  harvestDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
