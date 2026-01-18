import { Module } from '@nestjs/common';
import { ExpenseService, CostCalculationService } from './expense.service';
import { ExpenseController } from './expense.controller';
import { EquipmentCostService } from './equipment-cost.service';
import { EquipmentCostController } from './equipment-cost.controller';
import { HarvestService } from './harvest.service';
import { HarvestController } from './harvest.controller';
import { RevenueService, RevenueCalculationService } from './revenue.service';
import { RevenueController } from './revenue.controller';
import { ProfitabilityService, ProfitabilityAnalysisService } from './profitability.service';
import { ProfitabilityController } from './profitability.controller';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { ExportService } from './export.service';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    ExpenseController,
    EquipmentCostController,
    HarvestController,
    RevenueController,
    ProfitabilityController,
    ReportController,
  ],
  providers: [
    ExpenseService,
    CostCalculationService,
    EquipmentCostService,
    HarvestService,
    RevenueService,
    RevenueCalculationService,
    ProfitabilityService,
    ProfitabilityAnalysisService,
    ReportService,
    ExportService,
  ],
  exports: [
    ExpenseService,
    CostCalculationService,
    EquipmentCostService,
    HarvestService,
    RevenueService,
    RevenueCalculationService,
    ProfitabilityService,
    ProfitabilityAnalysisService,
    ReportService,
    ExportService,
  ],
})
export class FinancialModule {}
