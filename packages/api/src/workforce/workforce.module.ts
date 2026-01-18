import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { WorkerController } from './worker.controller';
import { TimeCardService } from './time-card.service';
import { TimeCardController } from './time-card.controller';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { LaborCostService } from './labor-cost.service';
import { PrismaModule } from '../prisma';
import { AuthModule } from '../auth';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WorkerController, TimeCardController, TaskController, ScheduleController],
  providers: [WorkerService, TimeCardService, TaskService, ScheduleService, LaborCostService],
  exports: [WorkerService, TimeCardService, TaskService, ScheduleService, LaborCostService],
})
export class WorkforceModule {}
