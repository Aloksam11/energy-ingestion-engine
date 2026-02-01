import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { PerformanceSummaryDto, CurrentStateDto } from './dto';

/**
 * Controller for analytics and performance endpoints
 * All queries are optimized to avoid full table scans
 */
@ApiTags('Analytics')
@Controller('v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Get 24-hour performance summary for a vehicle
   * Returns total AC consumed, DC delivered, efficiency ratio, and avg battery temp
   */
  @Get('performance/:vehicleId')
  @ApiOperation({
    summary: 'Get 24-hour vehicle performance summary',
    description:
      'Returns energy efficiency metrics including AC consumed vs DC delivered ratio',
  })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle identifier' })
  @ApiResponse({
    status: 200,
    description: 'Performance summary retrieved successfully',
    type: PerformanceSummaryDto,
  })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async getPerformanceSummary(
    @Param('vehicleId') vehicleId: string,
  ): Promise<PerformanceSummaryDto> {
    return this.analyticsService.getPerformanceSummary(vehicleId);
  }

  /**
   * Get current state for a vehicle (from hot storage)
   * Fast O(1) lookup for dashboard display
   */
  @Get('current/:vehicleId')
  @ApiOperation({
    summary: 'Get current vehicle state',
    description: 'Returns the latest known state from hot storage for fast dashboard access',
  })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle identifier' })
  @ApiResponse({
    status: 200,
    description: 'Current state retrieved successfully',
    type: CurrentStateDto,
  })
  @ApiResponse({ status: 404, description: 'Vehicle state not found' })
  async getCurrentState(
    @Param('vehicleId') vehicleId: string,
  ): Promise<CurrentStateDto> {
    return this.analyticsService.getCurrentState(vehicleId);
  }

  /**
   * Get fleet-wide statistics
   * Uses hot storage for fast aggregation
   */
  @Get('fleet/stats')
  @ApiOperation({
    summary: 'Get fleet-wide statistics',
    description: 'Returns aggregated statistics for the entire fleet from hot storage',
  })
  @ApiResponse({
    status: 200,
    description: 'Fleet statistics retrieved successfully',
  })
  async getFleetStats() {
    return this.analyticsService.getFleetStats();
  }
}
