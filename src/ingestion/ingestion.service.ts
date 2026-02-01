import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { MeterTelemetryDto, VehicleTelemetryDto } from './dto';

/**
 * Service for handling telemetry data ingestion
 * Implements dual-write strategy:
 * - COLD PATH: INSERT append-only to historical tables
 * - HOT PATH: UPSERT to current state tables
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ingest meter telemetry data
   * - Creates meter if not exists (auto-registration)
   * - INSERT to cold storage (meter_readings)
   * - UPSERT to hot storage (meter_current_state)
   */
  async ingestMeterTelemetry(dto: MeterTelemetryDto): Promise<{
    success: boolean;
    meterId: string;
    readingId: string;
  }> {
    const timestamp = new Date(dto.timestamp);

    // Use transaction for atomic operation
    const result = await this.prisma.$transaction(async (tx) => {
      // Auto-register meter if not exists
      await tx.meter.upsert({
        where: { meterId: dto.meterId },
        update: {},
        create: {
          meterId: dto.meterId,
          name: `Meter ${dto.meterId}`,
        },
      });

      // COLD PATH: Append to historical readings (INSERT)
      const reading = await tx.meterReading.create({
        data: {
          meterId: dto.meterId,
          kwhConsumedAc: dto.kwhConsumedAc,
          voltage: dto.voltage,
          timestamp,
        },
      });

      // HOT PATH: Update current state (UPSERT)
      await tx.meterCurrentState.upsert({
        where: { meterId: dto.meterId },
        update: {
          kwhConsumedAc: dto.kwhConsumedAc,
          voltage: dto.voltage,
          lastTimestamp: timestamp,
        },
        create: {
          meterId: dto.meterId,
          kwhConsumedAc: dto.kwhConsumedAc,
          voltage: dto.voltage,
          lastTimestamp: timestamp,
        },
      });

      return reading;
    });

    this.logger.debug(
      `Ingested meter reading: ${dto.meterId} at ${dto.timestamp}`,
    );

    return {
      success: true,
      meterId: dto.meterId,
      readingId: result.id,
    };
  }

  /**
   * Ingest vehicle telemetry data
   * - Creates vehicle if not exists (auto-registration)
   * - INSERT to cold storage (vehicle_readings)
   * - UPSERT to hot storage (vehicle_current_state)
   */
  async ingestVehicleTelemetry(dto: VehicleTelemetryDto): Promise<{
    success: boolean;
    vehicleId: string;
    readingId: string;
  }> {
    const timestamp = new Date(dto.timestamp);

    // Use transaction for atomic operation
    const result = await this.prisma.$transaction(async (tx) => {
      // Auto-register vehicle if not exists
      await tx.vehicle.upsert({
        where: { vehicleId: dto.vehicleId },
        update: {},
        create: {
          vehicleId: dto.vehicleId,
          name: `Vehicle ${dto.vehicleId}`,
        },
      });

      // COLD PATH: Append to historical readings (INSERT)
      const reading = await tx.vehicleReading.create({
        data: {
          vehicleId: dto.vehicleId,
          soc: dto.soc,
          kwhDeliveredDc: dto.kwhDeliveredDc,
          batteryTemp: dto.batteryTemp,
          timestamp,
        },
      });

      // HOT PATH: Update current state (UPSERT)
      await tx.vehicleCurrentState.upsert({
        where: { vehicleId: dto.vehicleId },
        update: {
          soc: dto.soc,
          kwhDeliveredDc: dto.kwhDeliveredDc,
          batteryTemp: dto.batteryTemp,
          lastTimestamp: timestamp,
        },
        create: {
          vehicleId: dto.vehicleId,
          soc: dto.soc,
          kwhDeliveredDc: dto.kwhDeliveredDc,
          batteryTemp: dto.batteryTemp,
          lastTimestamp: timestamp,
        },
      });

      return reading;
    });

    this.logger.debug(
      `Ingested vehicle reading: ${dto.vehicleId} at ${dto.timestamp}`,
    );

    return {
      success: true,
      vehicleId: dto.vehicleId,
      readingId: result.id,
    };
  }

  /**
   * Batch ingest meter telemetry for high-throughput scenarios
   * Uses createMany for efficient bulk inserts
   */
  async batchIngestMeterTelemetry(readings: MeterTelemetryDto[]): Promise<{
    success: boolean;
    count: number;
    meterIds: string[];
  }> {
    const meterIds = [...new Set(readings.map((r) => r.meterId))];

    await this.prisma.$transaction(async (tx) => {
      // Auto-register all meters
      for (const meterId of meterIds) {
        await tx.meter.upsert({
          where: { meterId },
          update: {},
          create: {
            meterId,
            name: `Meter ${meterId}`,
          },
        });
      }

      // COLD PATH: Bulk insert to historical readings
      await tx.meterReading.createMany({
        data: readings.map((dto) => ({
          meterId: dto.meterId,
          kwhConsumedAc: dto.kwhConsumedAc,
          voltage: dto.voltage,
          timestamp: new Date(dto.timestamp),
        })),
      });

      // HOT PATH: Update current state for each meter (latest reading)
      const latestByMeter = new Map<string, MeterTelemetryDto>();
      for (const reading of readings) {
        const existing = latestByMeter.get(reading.meterId);
        if (
          !existing ||
          new Date(reading.timestamp) > new Date(existing.timestamp)
        ) {
          latestByMeter.set(reading.meterId, reading);
        }
      }

      for (const [meterId, latest] of latestByMeter) {
        await tx.meterCurrentState.upsert({
          where: { meterId },
          update: {
            kwhConsumedAc: latest.kwhConsumedAc,
            voltage: latest.voltage,
            lastTimestamp: new Date(latest.timestamp),
          },
          create: {
            meterId,
            kwhConsumedAc: latest.kwhConsumedAc,
            voltage: latest.voltage,
            lastTimestamp: new Date(latest.timestamp),
          },
        });
      }
    });

    this.logger.log(`Batch ingested ${readings.length} meter readings`);

    return {
      success: true,
      count: readings.length,
      meterIds,
    };
  }

  /**
   * Batch ingest vehicle telemetry for high-throughput scenarios
   * Uses createMany for efficient bulk inserts
   */
  async batchIngestVehicleTelemetry(readings: VehicleTelemetryDto[]): Promise<{
    success: boolean;
    count: number;
    vehicleIds: string[];
  }> {
    const vehicleIds = [...new Set(readings.map((r) => r.vehicleId))];

    await this.prisma.$transaction(async (tx) => {
      // Auto-register all vehicles
      for (const vehicleId of vehicleIds) {
        await tx.vehicle.upsert({
          where: { vehicleId },
          update: {},
          create: {
            vehicleId,
            name: `Vehicle ${vehicleId}`,
          },
        });
      }

      // COLD PATH: Bulk insert to historical readings
      await tx.vehicleReading.createMany({
        data: readings.map((dto) => ({
          vehicleId: dto.vehicleId,
          soc: dto.soc,
          kwhDeliveredDc: dto.kwhDeliveredDc,
          batteryTemp: dto.batteryTemp,
          timestamp: new Date(dto.timestamp),
        })),
      });

      // HOT PATH: Update current state for each vehicle (latest reading)
      const latestByVehicle = new Map<string, VehicleTelemetryDto>();
      for (const reading of readings) {
        const existing = latestByVehicle.get(reading.vehicleId);
        if (
          !existing ||
          new Date(reading.timestamp) > new Date(existing.timestamp)
        ) {
          latestByVehicle.set(reading.vehicleId, reading);
        }
      }

      for (const [vehicleId, latest] of latestByVehicle) {
        await tx.vehicleCurrentState.upsert({
          where: { vehicleId },
          update: {
            soc: latest.soc,
            kwhDeliveredDc: latest.kwhDeliveredDc,
            batteryTemp: latest.batteryTemp,
            lastTimestamp: new Date(latest.timestamp),
          },
          create: {
            vehicleId,
            soc: latest.soc,
            kwhDeliveredDc: latest.kwhDeliveredDc,
            batteryTemp: latest.batteryTemp,
            lastTimestamp: new Date(latest.timestamp),
          },
        });
      }
    });

    this.logger.log(`Batch ingested ${readings.length} vehicle readings`);

    return {
      success: true,
      count: readings.length,
      vehicleIds,
    };
  }

  /**
   * Associate a vehicle with a meter for efficiency correlation
   */
  async associateVehicleWithMeter(
    vehicleId: string,
    meterId: string,
  ): Promise<{ success: boolean }> {
    await this.prisma.vehicle.update({
      where: { vehicleId },
      data: { meterId },
    });

    this.logger.log(`Associated vehicle ${vehicleId} with meter ${meterId}`);

    return { success: true };
  }
}
