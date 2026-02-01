import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { PerformanceSummaryDto, CurrentStateDto } from './dto';

// Efficiency thresholds (as per assignment: below 85% indicates issues)
const EFFICIENCY_THRESHOLD_WARNING = 85;
const EFFICIENCY_THRESHOLD_CRITICAL = 75;

/**
 * Service for analytics and performance calculations
 * Uses indexed queries to avoid full table scans on historical data
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get 24-hour performance summary for a vehicle
   * Uses indexed queries on (vehicleId, timestamp) for efficient data retrieval
   *
   * Key Performance Considerations:
   * - Uses composite index (vehicle_id, timestamp) on vehicle_readings
   * - Uses composite index (meter_id, timestamp) on meter_readings
   * - Queries are bounded by time range to avoid full table scans
   */
  async getPerformanceSummary(vehicleId: string): Promise<PerformanceSummaryDto> {
    // Calculate time range (last 24 hours)
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

    // Get vehicle with its associated meter
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { vehicleId },
      include: { meter: true },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    }

    // Query vehicle readings using indexed (vehicleId, timestamp) lookup
    // This uses the composite index for efficient range scan
    const vehicleReadings = await this.prisma.vehicleReading.findMany({
      where: {
        vehicleId,
        timestamp: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Calculate vehicle metrics
    let totalDcDelivered = 0;
    let totalBatteryTemp = 0;
    let vehicleReadingCount = vehicleReadings.length;

    if (vehicleReadingCount > 0) {
      // Calculate energy delivered as sum of incremental deliveries
      // For cumulative meters, we calculate the difference
      const firstReading = vehicleReadings[0];
      const lastReading = vehicleReadings[vehicleReadings.length - 1];
      totalDcDelivered = lastReading.kwhDeliveredDc - firstReading.kwhDeliveredDc;

      // If negative (counter reset), use sum of positive deltas
      if (totalDcDelivered < 0) {
        totalDcDelivered = 0;
        for (let i = 1; i < vehicleReadings.length; i++) {
          const delta =
            vehicleReadings[i].kwhDeliveredDc -
            vehicleReadings[i - 1].kwhDeliveredDc;
          if (delta > 0) {
            totalDcDelivered += delta;
          }
        }
      }

      // Average battery temperature
      totalBatteryTemp =
        vehicleReadings.reduce((sum, r) => sum + r.batteryTemp, 0) /
        vehicleReadingCount;
    }

    // Query meter readings if vehicle has associated meter
    let totalAcConsumed = 0;
    let meterReadingCount = 0;

    if (vehicle.meterId) {
      // Query meter readings using indexed (meterId, timestamp) lookup
      const meterReadings = await this.prisma.meterReading.findMany({
        where: {
          meterId: vehicle.meterId,
          timestamp: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      meterReadingCount = meterReadings.length;

      if (meterReadingCount > 0) {
        const firstReading = meterReadings[0];
        const lastReading = meterReadings[meterReadings.length - 1];
        totalAcConsumed = lastReading.kwhConsumedAc - firstReading.kwhConsumedAc;

        // Handle counter reset
        if (totalAcConsumed < 0) {
          totalAcConsumed = 0;
          for (let i = 1; i < meterReadings.length; i++) {
            const delta =
              meterReadings[i].kwhConsumedAc -
              meterReadings[i - 1].kwhConsumedAc;
            if (delta > 0) {
              totalAcConsumed += delta;
            }
          }
        }
      }
    }

    // Calculate efficiency ratio (DC/AC * 100)
    let efficiencyRatio = 0;
    if (totalAcConsumed > 0) {
      efficiencyRatio = (totalDcDelivered / totalAcConsumed) * 100;
    }

    // Determine efficiency status
    let efficiencyStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    if (efficiencyRatio > 0) {
      if (efficiencyRatio < EFFICIENCY_THRESHOLD_CRITICAL) {
        efficiencyStatus = 'CRITICAL';
      } else if (efficiencyRatio < EFFICIENCY_THRESHOLD_WARNING) {
        efficiencyStatus = 'WARNING';
      }
    }

    this.logger.debug(
      `Performance summary for ${vehicleId}: AC=${totalAcConsumed}kWh, DC=${totalDcDelivered}kWh, Efficiency=${efficiencyRatio.toFixed(2)}%`,
    );

    return {
      vehicleId,
      meterId: vehicle.meterId,
      periodStart,
      periodEnd,
      totalAcConsumed: Math.round(totalAcConsumed * 100) / 100,
      totalDcDelivered: Math.round(totalDcDelivered * 100) / 100,
      efficiencyRatio: Math.round(efficiencyRatio * 100) / 100,
      avgBatteryTemp: Math.round(totalBatteryTemp * 100) / 100,
      vehicleReadingCount,
      meterReadingCount,
      efficiencyStatus,
    };
  }

  /**
   * Get current state for a vehicle (from hot storage)
   * Uses unique index lookup - O(1) operation
   */
  async getCurrentState(vehicleId: string): Promise<CurrentStateDto> {
    const currentState = await this.prisma.vehicleCurrentState.findUnique({
      where: { vehicleId },
    });

    if (!currentState) {
      throw new NotFoundException(
        `No current state found for vehicle ${vehicleId}`,
      );
    }

    return {
      vehicleId: currentState.vehicleId,
      currentSoc: currentState.soc,
      currentBatteryTemp: currentState.batteryTemp,
      lastKwhDeliveredDc: currentState.kwhDeliveredDc,
      lastUpdated: currentState.lastTimestamp,
    };
  }

  /**
   * Get fleet-wide statistics for operational monitoring
   * Uses aggregation on current state tables (hot storage) for fast response
   */
  async getFleetStats(): Promise<{
    totalVehicles: number;
    totalMeters: number;
    activeVehicles: number;
    activeMeters: number;
    avgFleetSoc: number;
    avgFleetBatteryTemp: number;
  }> {
    // Query from hot storage for fast aggregation
    const [
      totalVehicles,
      totalMeters,
      vehicleStates,
      meterStates,
    ] = await Promise.all([
      this.prisma.vehicle.count(),
      this.prisma.meter.count(),
      this.prisma.vehicleCurrentState.findMany(),
      this.prisma.meterCurrentState.findMany(),
    ]);

    // Calculate averages from current state (hot storage)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const activeVehicleStates = vehicleStates.filter(
      (v) => v.lastTimestamp >= fiveMinutesAgo,
    );
    const activeMeterStates = meterStates.filter(
      (m) => m.lastTimestamp >= fiveMinutesAgo,
    );

    const avgFleetSoc =
      activeVehicleStates.length > 0
        ? activeVehicleStates.reduce((sum, v) => sum + v.soc, 0) /
          activeVehicleStates.length
        : 0;

    const avgFleetBatteryTemp =
      activeVehicleStates.length > 0
        ? activeVehicleStates.reduce((sum, v) => sum + v.batteryTemp, 0) /
          activeVehicleStates.length
        : 0;

    return {
      totalVehicles,
      totalMeters,
      activeVehicles: activeVehicleStates.length,
      activeMeters: activeMeterStates.length,
      avgFleetSoc: Math.round(avgFleetSoc * 100) / 100,
      avgFleetBatteryTemp: Math.round(avgFleetBatteryTemp * 100) / 100,
    };
  }
}
