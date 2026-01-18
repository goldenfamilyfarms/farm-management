import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ExpenseCategory } from '@prisma/client';

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @IsNumber()
  @Min(0.01, { message: 'amount must be greater than 0' })
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cropType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  vendor?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsNumber()
  @Min(0.01, { message: 'amount must be greater than 0' })
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  fieldId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cropType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  vendor?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
