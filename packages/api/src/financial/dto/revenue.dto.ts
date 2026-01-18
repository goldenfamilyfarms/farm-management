import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRevenueDto {
  @IsOptional()
  @IsUUID()
  harvestId?: string;

  @IsUUID()
  fieldId!: string;

  @IsString()
  @MaxLength(100)
  cropType!: string;

  @IsNumber()
  @Min(0.01, { message: 'quantity must be greater than 0' })
  quantity!: number;

  @IsString()
  @MaxLength(20)
  unit!: string;

  @IsNumber()
  @Min(0.01, { message: 'pricePerUnit must be greater than 0' })
  pricePerUnit!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsDateString()
  saleDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  buyer?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRevenueDto {
  @IsOptional()
  @IsUUID()
  harvestId?: string;

  @IsOptional()
  @IsUUID()
  fieldId?: string;

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
  @IsNumber()
  @Min(0.01, { message: 'pricePerUnit must be greater than 0' })
  pricePerUnit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsDateString()
  saleDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  buyer?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
