import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { EmploymentType } from '@prisma/client';

export class CreateWorkerDto {
  @IsUUID()
  userId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  certifications?: CertificationDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateWorkerDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  certifications?: CertificationDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CertificationDto {
  @IsString()
  name!: string;

  @IsString()
  issuedBy!: string;

  @IsDateString()
  issuedDate!: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export interface WorkerResponseDto {
  id: string;
  userId: string;
  farmId: string;
  skills: string[];
  certifications: CertificationDto[];
  hourlyRate: number | null;
  employmentType: EmploymentType;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email: string;
    role: string;
    profile: Record<string, unknown>;
  };
}
