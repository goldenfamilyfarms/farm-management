import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { EquipmentCostService } from './equipment-cost.service';
import {
  AllocateEquipmentCostDto,
  GetEquipmentCostSummaryDto,
  GetTotalEquipmentCostDto,
} from './dto/equipment-cost.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('equipment-costs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EquipmentCostController {
  constructor(private readonly equipmentCostService: EquipmentCostService) {}

  @Post('allocate-to-field')
  @Roles('owner', 'manager', 'viewer')
  async allocateToField(@Body() dto: AllocateEquipmentCostDto) {
    return this.equipmentCostService.allocateEquipmentCostToField(
      dto.config,
      dto.fieldId,
      { startDate: dto.startDate, endDate: dto.endDate },
    );
  }

  @Post('summary')
  @Roles('owner', 'manager', 'viewer')
  async getSummary(@Body() dto: GetEquipmentCostSummaryDto) {
    return this.equipmentCostService.getEquipmentCostSummary(
      dto.config,
      { startDate: dto.startDate, endDate: dto.endDate },
    );
  }

  @Post('total-for-field')
  @Roles('owner', 'manager', 'viewer')
  async getTotalForField(@Body() dto: GetTotalEquipmentCostDto) {
    return this.equipmentCostService.getTotalEquipmentCostForField(
      dto.fieldId,
      dto.equipmentConfigs,
      { startDate: dto.startDate, endDate: dto.endDate },
    );
  }
}
