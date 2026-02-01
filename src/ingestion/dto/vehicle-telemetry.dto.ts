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
 * DTO for Electric Vehicle telemetry data ingestion
 * Represents a single vehicle reading from the charger/vehicle side
 */
export class VehicleTelemetryDto {
  @ApiProperty({
    description: 'Unique identifier for the vehicle',
    example: 'VEH-001',
  })
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @ApiProperty({
    description: 'State of Charge - Battery percentage (0-100%)',
    example: 75.5,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  soc: number;

  @ApiProperty({
    description: 'DC energy delivered to battery in kWh',
    example: 45.2,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  kwhDeliveredDc: number;

  @ApiProperty({
    description: 'Battery temperature in Celsius',
    example: 35.0,
    minimum: -50,
    maximum: 100,
  })
  @IsNumber()
  @Min(-50)
  @Max(100)
  batteryTemp: number;

  @ApiProperty({
    description: 'Timestamp of the reading (ISO 8601 format)',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsDateString()
  timestamp: string;
}

/**
 * DTO for batch vehicle telemetry ingestion
 */
export class BatchVehicleTelemetryDto {
  @ApiProperty({
    description: 'Array of vehicle telemetry readings',
    type: [VehicleTelemetryDto],
  })
  readings: VehicleTelemetryDto[];
}
