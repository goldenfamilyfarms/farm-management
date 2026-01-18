import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { TimeCardService } from './time-card.service';
import { ClockInDto, ClockOutDto, TimeCardQueryDto } from './dto/time-card.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('time-cards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeCardController {
  constructor(private readonly timeCardService: TimeCardService) {}

  /**
   * Clock in a worker - creates a new time card
   * POST /time-cards/clock-in
   */
  @Post('clock-in')
  @Roles('owner', 'manager', 'worker')
  async clockIn(@Body() dto: ClockInDto) {
    return this.timeCardService.clockIn(dto);
  }

  /**
   * Clock out a worker - updates time card with clock-out time and calculates total hours
   * POST /time-cards/:id/clock-out
   */
  @Post(':id/clock-out')
  @Roles('owner', 'manager', 'worker')
  async clockOut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClockOutDto,
  ) {
    return this.timeCardService.clockOut(id, dto);
  }

  /**
   * Get all time cards with optional filters
   * GET /time-cards
   */
  @Get()
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findAll(@Query() query: TimeCardQueryDto) {
    return this.timeCardService.findAll(query);
  }

  /**
   * Get active time card for a worker
   * GET /time-cards/active/:workerId
   */
  @Get('active/:workerId')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async getActiveTimeCard(@Param('workerId', ParseUUIDPipe) workerId: string) {
    return this.timeCardService.getActiveTimeCard(workerId);
  }

  /**
   * Get a specific time card by ID
   * GET /time-cards/:id
   */
  @Get(':id')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.timeCardService.findOne(id);
  }

  /**
   * Get all time cards for a specific worker
   * GET /time-cards/worker/:workerId
   */
  @Get('worker/:workerId')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findByWorkerId(@Param('workerId', ParseUUIDPipe) workerId: string) {
    return this.timeCardService.findByWorkerId(workerId);
  }

  /**
   * Delete a time card (only if not approved)
   * DELETE /time-cards/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('owner', 'manager')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.timeCardService.delete(id);
  }
}
