import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma service for database operations
 * Manages connection lifecycle and provides access to Prisma client
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Clean database - useful for testing
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    // Delete in order respecting foreign key constraints
    await this.$transaction([
      this.meterCurrentState.deleteMany(),
      this.vehicleCurrentState.deleteMany(),
      this.meterReading.deleteMany(),
      this.vehicleReading.deleteMany(),
      this.vehicle.deleteMany(),
      this.meter.deleteMany(),
    ]);
  }
}
