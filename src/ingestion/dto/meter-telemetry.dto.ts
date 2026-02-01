import {
  IsString,
  IsNumber,
  IsDateString,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for Smart Meter telemetry data ingestion
 * Represents a single meter reading from the grid side
 */
export class MeterTelemetryDto {
  @ApiProperty({
    description: 'Unique identifier for the smart meter',
    example: 'METER-001',
  })
  @IsString()
  @IsNotEmpty()
  meterId: string;

  @ApiProperty({
    description: 'Total AC energy consumed from grid in kWh',
    example: 125.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  kwhConsumedAc: number;

  @ApiProperty({
    description: 'Grid voltage in volts',
    example: 230.5,
    minimum: 0,
    maximum: 500,
  })
  @IsNumber()
  @Min(0)
  @Max(500)
  voltage: number;

  @ApiProperty({
    description: 'Timestamp of the reading (ISO 8601 format)',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsDateString()
  timestamp: string;
}

/**
 * DTO for batch meter telemetry ingestion
 */
export class BatchMeterTelemetryDto {
  @ApiProperty({
    description: 'Array of meter telemetry readings',
    type: [MeterTelemetryDto],
  })
  readings: MeterTelemetryDto[];
}
