import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GeoPolygonDto {
  @IsString()
  type!: 'Polygon';

  @IsArray()
  @ArrayMinSize(1)
  @IsArray({ each: true })
  coordinates!: number[][][];
}

export class CreateFieldDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @ValidateNested()
  @Type(() => GeoPolygonDto)
  boundary!: GeoPolygonDto;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  soilType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  irrigationType?: string;
}

export class UpdateFieldDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPolygonDto)
  boundary?: GeoPolygonDto;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  soilType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  irrigationType?: string;
}

export interface FieldResponseDto {
  id: string;
  farmId: string;
  name: string;
  boundary: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  acreage: number | null;
  soilType: string | null;
  irrigationType: string | null;
  createdAt: Date;
  updatedAt: Date;
}
