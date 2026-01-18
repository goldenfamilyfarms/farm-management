import { IsString, IsOptional, IsDateString, IsUUID, Matches } from 'class-validator';

export class CreateScheduleDto {
  @IsUUID()
  workerId!: string;

  @IsDateString()
  date!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ScheduleQueryDto {
  @IsOptional()
  @IsUUID()
  workerId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export interface ScheduleResponseDto {
  id: string;
  farmId: string;
  workerId: string;
  date: Date;
  startTime: string;
  endTime: string;
  role: string | null;
  notes: string | null;
  createdAt: Date;
  worker?: {
    id: string;
    userId: string;
    user?: {
      email: string;
      profile: unknown;
    };
  };
}

export interface ScheduleConflict {
  existingScheduleId: string;
  date: Date;
  existingStartTime: string;
  existingEndTime: string;
  newStartTime: string;
  newEndTime: string;
}
