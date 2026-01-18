import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ResourceUsageService } from './resource-usage.service';
import { ResourceUsageQueryDto } from './dto/resource-usage.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ResourceType } from '@prisma/client';

@Controller('resource-usage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResourceUsageController {
  constructor(private readonly resourceUsageService: ResourceUsageService) {}

  /**
   * Get aggregated resource usage summary.
   * Supports filtering by field, zone, resource type, and date range.
   * Returns totals grouped by field, zone, and resource type.
   */
  @Get('summary')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async getUsageSummary(
    @Query('fieldId') fieldId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('resourceType') resourceType?: ResourceType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const query: ResourceUsageQueryDto = {
      fieldId,
      zoneId,
      resourceType,
      startDate,
      endDate,
    };

    return this.resourceUsageService.getUsageSummary(query);
  }
}
