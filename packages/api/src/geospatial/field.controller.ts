import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FieldService } from './field.service';
import { CreateFieldDto, UpdateFieldDto } from './dto/field.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('fields')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FieldController {
  constructor(private readonly fieldService: FieldService) {}

  @Post()
  @Roles('owner', 'manager')
  async create(@Body() dto: CreateFieldDto) {
    return this.fieldService.create(dto);
  }

  @Get()
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findAll() {
    return this.fieldService.findAll();
  }

  @Get(':id')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fieldService.findOne(id);
  }

  @Get(':id/with-zones')
  @Roles('owner', 'manager', 'worker', 'viewer')
  async findOneWithZones(@Param('id', ParseUUIDPipe) id: string) {
    return this.fieldService.findOneWithZones(id);
  }

  @Put(':id')
  @Roles('owner', 'manager')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFieldDto,
  ) {
    return this.fieldService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('owner', 'manager')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.fieldService.delete(id);
  }
}
