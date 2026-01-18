import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EquipmentCostConfigDto {
  @IsUUID()
  equipmentId!: string;

  @IsNumber()
  @Min(0)
  purchasePrice!: number;

  @IsNumber()
  @Min(1)
  usefulLifeHours!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salvageValue?: number;
}

export class AllocateEquipmentCostDto {
  @ValidateNested()
  @Type(() => EquipmentCostConfigDto)
  config!: EquipmentCostConfigDto;

  @IsUUID()
  fieldId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class GetEquipmentCostSummaryDto {
  @ValidateNested()
  @Type(() => EquipmentCostConfigDto)
  config!: EquipmentCostConfigDto;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class GetTotalEquipmentCostDto {
  @IsUUID()
  fieldId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EquipmentCostConfigDto)
  equipmentConfigs!: EquipmentCostConfigDto[];

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
