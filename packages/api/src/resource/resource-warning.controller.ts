import {
  Controller,
  Get,
  Post,
  Param,
  Query,
} from '@nestjs/common';
import { ResourceWarningService } from './resource-warning.service';
import { ResourceWarningQueryDto } from './dto/resource-warning.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TokenPayload } from '../auth/auth.service';

@Controller('resource-warnings')
export class ResourceWarningController {
  constructor(private readonly resourceWarningService: ResourceWarningService) {}

  @Get()
  async findAll(@Query() query: ResourceWarningQueryDto) {
    return this.resourceWarningService.findAll(query);
  }

  @Get('count/unacknowledged')
  async getUnacknowledgedCount() {
    const count = await this.resourceWarningService.getUnacknowledgedCount();
    return { count };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.resourceWarningService.findOne(id);
  }

  @Post(':id/acknowledge')
  async acknowledge(
    @Param('id') id: string,
    @CurrentUser() user: TokenPayload,
  ) {
    return this.resourceWarningService.acknowledge(id, user.userId);
  }
}
