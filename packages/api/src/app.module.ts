import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth';
import { TelemetryModule } from './telemetry';
import { ResourceModule } from './resource';
import { GeospatialModule } from './geospatial';
import { FinancialModule } from './financial';
import { WorkforceModule } from './workforce';
import { MaintenanceModule } from './maintenance';
import { RecommendationModule } from './recommendation';
import { WeatherModule } from './weather';
import { DashboardModule } from './dashboard';
import { TenantInterceptor } from './auth/tenant/tenant.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    AuthModule,
    TelemetryModule,
    ResourceModule,
    GeospatialModule,
    FinancialModule,
    WorkforceModule,
    MaintenanceModule,
    RecommendationModule,
    WeatherModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
