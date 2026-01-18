import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { TimeCardStatus } from '@prisma/client';

export class ClockInDto {
  @IsUUID()
  workerId!: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ClockOutDto {
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTimeCardDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class TimeCardQueryDto {
  @IsOptional()
  @IsUUID()
  workerId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  status?: TimeCardStatus;
}

export interface TimeCardResponseDto {
  id: string;
  farmId: string;
  workerId: string;
  clockIn: Date;
  clockOut: Date | null;
  totalHours: number | null;
  status: TimeCardStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  notes: string | null;
  flaggedForReview: boolean;
  createdAt: Date;
  worker?: {
    id: string;
    userId: string;
    user?: {
      id: string;
      email: string;
      profile: Record<string, unknown>;
    };
  };
}
