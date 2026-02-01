import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { IngestionService } from './ingestion.service';
import {
  MeterTelemetryDto,
  VehicleTelemetryDto,
  BatchMeterTelemetryDto,
  BatchVehicleTelemetryDto,
} from './dto';

/**
 * Controller for handling telemetry data ingestion
 * Supports both single and batch ingestion for meters and vehicles
 */
@ApiTags('Ingestion')
@Controller('v1/ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  /**
   * Ingest a single meter telemetry reading
   */
  @Post('meter')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ingest meter telemetry',
    description: 'Accepts a single meter reading and stores in hot/cold paths',
  })
  @ApiBody({ type: MeterTelemetryDto })
  @ApiResponse({
    status: 201,
    description: 'Meter reading successfully ingested',
  })
  @ApiResponse({ status: 400, description: 'Invalid request payload' })
  async ingestMeterTelemetry(@Body() dto: MeterTelemetryDto) {
    return this.ingestionService.ingestMeterTelemetry(dto);
  }

  /**
   * Ingest a single vehicle telemetry reading
   */
  @Post('vehicle')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Ingest vehicle telemetry',
    description:
      'Accepts a single vehicle reading and stores in hot/cold paths',
  })
  @ApiBody({ type: VehicleTelemetryDto })
  @ApiResponse({
    status: 201,
    description: 'Vehicle reading successfully ingested',
  })
  @ApiResponse({ status: 400, description: 'Invalid request payload' })
  async ingestVehicleTelemetry(@Body() dto: VehicleTelemetryDto) {
    return this.ingestionService.ingestVehicleTelemetry(dto);
  }

  /**
   * Batch ingest meter telemetry readings
   * Optimized for high-throughput scenarios
   */
  @Post('meter/batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Batch ingest meter telemetry',
    description: 'Accepts multiple meter readings for efficient bulk ingestion',
  })
  @ApiBody({ type: BatchMeterTelemetryDto })
  @ApiResponse({
    status: 201,
    description: 'Meter readings successfully ingested',
  })
  @ApiResponse({ status: 400, description: 'Invalid request payload' })
  async batchIngestMeterTelemetry(@Body() dto: BatchMeterTelemetryDto) {
    return this.ingestionService.batchIngestMeterTelemetry(dto.readings);
  }

  /**
   * Batch ingest vehicle telemetry readings
   * Optimized for high-throughput scenarios
   */
  @Post('vehicle/batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Batch ingest vehicle telemetry',
    description:
      'Accepts multiple vehicle readings for efficient bulk ingestion',
  })
  @ApiBody({ type: BatchVehicleTelemetryDto })
  @ApiResponse({
    status: 201,
    description: 'Vehicle readings successfully ingested',
  })
  @ApiResponse({ status: 400, description: 'Invalid request payload' })
  async batchIngestVehicleTelemetry(@Body() dto: BatchVehicleTelemetryDto) {
    return this.ingestionService.batchIngestVehicleTelemetry(dto.readings);
  }

  /**
   * Associate a vehicle with a meter for efficiency correlation
   */
  @Patch('vehicle/:vehicleId/meter/:meterId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Associate vehicle with meter',
    description:
      'Links a vehicle to a meter for AC/DC efficiency correlation analysis',
  })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle identifier' })
  @ApiParam({ name: 'meterId', description: 'Meter identifier' })
  @ApiResponse({
    status: 200,
    description: 'Vehicle successfully associated with meter',
  })
  @ApiResponse({ status: 404, description: 'Vehicle or meter not found' })
  async associateVehicleWithMeter(
    @Param('vehicleId') vehicleId: string,
    @Param('meterId') meterId: string,
  ) {
    return this.ingestionService.associateVehicleWithMeter(vehicleId, meterId);
  }
}
