import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for 24-hour vehicle performance analytics response
 */
export class PerformanceSummaryDto {
  @ApiProperty({
    description: 'Vehicle identifier',
    example: 'VEH-001',
  })
  vehicleId: string;

  @ApiProperty({
    description: 'Associated meter identifier',
    example: 'METER-001',
    nullable: true,
  })
  meterId: string | null;

  @ApiProperty({
    description: 'Start of the 24-hour analysis period',
    example: '2024-01-14T10:30:00.000Z',
  })
  periodStart: Date;

  @ApiProperty({
    description: 'End of the 24-hour analysis period',
    example: '2024-01-15T10:30:00.000Z',
  })
  periodEnd: Date;

  @ApiProperty({
    description: 'Total AC energy consumed from grid in kWh',
    example: 125.5,
  })
  totalAcConsumed: number;

  @ApiProperty({
    description: 'Total DC energy delivered to battery in kWh',
    example: 108.2,
  })
  totalDcDelivered: number;

  @ApiProperty({
    description: 'Efficiency ratio (DC/AC) as percentage',
    example: 86.2,
  })
  efficiencyRatio: number;

  @ApiProperty({
    description: 'Average battery temperature in Celsius',
    example: 32.5,
  })
  avgBatteryTemp: number;

  @ApiProperty({
    description: 'Number of vehicle readings in the period',
    example: 1440,
  })
  vehicleReadingCount: number;

  @ApiProperty({
    description: 'Number of meter readings in the period',
    example: 1440,
  })
  meterReadingCount: number;

  @ApiProperty({
    description: 'Efficiency status based on threshold (85%)',
    enum: ['HEALTHY', 'WARNING', 'CRITICAL'],
    example: 'HEALTHY',
  })
  efficiencyStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

/**
 * DTO for current device state response
 */
export class CurrentStateDto {
  @ApiProperty({
    description: 'Vehicle identifier',
    example: 'VEH-001',
  })
  vehicleId: string;

  @ApiProperty({
    description: 'Current State of Charge percentage',
    example: 75.5,
  })
  currentSoc: number;

  @ApiProperty({
    description: 'Current battery temperature in Celsius',
    example: 35.0,
  })
  currentBatteryTemp: number;

  @ApiProperty({
    description: 'Last DC energy delivered reading',
    example: 45.2,
  })
  lastKwhDeliveredDc: number;

  @ApiProperty({
    description: 'Timestamp of the last reading',
    example: '2024-01-15T10:30:00.000Z',
  })
  lastUpdated: Date;
}
