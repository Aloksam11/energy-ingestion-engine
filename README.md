# High-Scale Energy Ingestion Engine

A high-performance telemetry ingestion system designed to handle **10,000+ Smart Meters and EV Fleets** with **60-second heartbeat intervals**, processing approximately **14.4 million records daily**.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Data Strategy](#data-strategy)
- [API Endpoints](#api-endpoints)
- [Quick Start](#quick-start)
- [Development](#development)
- [Performance Considerations](#performance-considerations)

## Overview

This system ingests two independent telemetry streams:

1. **Smart Meter Stream** (Grid Side): Measures AC power consumption from the utility grid
2. **Vehicle Stream** (Vehicle Side): Reports DC energy delivered to EV batteries and State of Charge

### Power Loss Thesis

In real-world scenarios, AC Consumed is always higher than DC Delivered due to conversion losses. An efficiency ratio below 85% indicates potential hardware faults or energy leakage.

```
Efficiency = (DC Delivered / AC Consumed) × 100%
```

## Architecture

### System Design

```
┌─────────────────┐     ┌─────────────────┐
│   Smart Meters  │     │   EV Vehicles   │
│   (10,000+)     │     │   (10,000+)     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │ 60s heartbeats        │ 60s heartbeats
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────────────┐
│              Ingestion Layer (NestJS)           │
│  ┌───────────────────────────────────────────┐  │
│  │         Polymorphic Validation            │  │
│  │  (class-validator / class-transformer)    │  │
│  └───────────────────────────────────────────┘  │
│                      │                          │
│         ┌────────────┴────────────┐             │
│         ▼                         ▼             │
│  ┌─────────────┐          ┌─────────────┐       │
│  │  COLD PATH  │          │  HOT PATH   │       │
│  │  (INSERT)   │          │  (UPSERT)   │       │
│  └─────────────┘          └─────────────┘       │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                PostgreSQL                        │
│  ┌─────────────────────┐  ┌──────────────────┐  │
│  │   Historical Store  │  │  Operational     │  │
│  │   (Cold Storage)    │  │  Store (Hot)     │  │
│  │                     │  │                  │  │
│  │  • meter_readings   │  │ • meter_current  │  │
│  │  • vehicle_readings │  │   _state         │  │
│  │                     │  │ • vehicle_current│  │
│  │  (Append-only)      │  │   _state         │  │
│  │                     │  │                  │  │
│  │  Indexed on:        │  │ (UPSERT on      │  │
│  │  (device_id,        │  │  unique key)    │  │
│  │   timestamp)        │  │                  │  │
│  └─────────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Technology Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: class-validator, class-transformer
- **API Docs**: Swagger/OpenAPI
- **Containerization**: Docker

## Data Strategy

### Hot vs Cold Storage

| Aspect | Cold Storage (Historical) | Hot Storage (Operational) |
|--------|---------------------------|---------------------------|
| **Purpose** | Long-term audit trail | Dashboard/real-time status |
| **Operation** | INSERT (append-only) | UPSERT (atomic update) |
| **Tables** | `meter_readings`, `vehicle_readings` | `meter_current_state`, `vehicle_current_state` |
| **Volume** | Billions of rows over time | One row per device |
| **Query Pattern** | Time-range analytics | Single-row lookups |

### Data Correlation

Vehicles are associated with meters to enable efficiency correlation:

```typescript
// Associate vehicle with meter
PATCH /v1/ingestion/vehicle/:vehicleId/meter/:meterId
```

This linkage allows the analytics endpoint to correlate AC consumption from the grid with DC delivery to the vehicle battery.

### Handling 14.4 Million Records Daily

**Calculation**: 10,000 devices × 2 streams × 60 readings/hour × 24 hours = **28.8M readings/day**

The system handles this volume through:

1. **Indexed Queries**: Composite indexes on `(device_id, timestamp)` enable efficient range scans
2. **Batch Ingestion**: Bulk insert endpoints for high-throughput scenarios
3. **Dual-Write Pattern**: Separate hot/cold paths prevent read/write contention
4. **Connection Pooling**: Prisma manages connection pooling for PostgreSQL

### Database Schema

```prisma
// Cold Storage - Append-only time-series
model MeterReading {
  id            String   @id @default(uuid())
  meterId       String   @map("meter_id")
  kwhConsumedAc Float    @map("kwh_consumed_ac")
  voltage       Float
  timestamp     DateTime
  receivedAt    DateTime @default(now())

  @@index([meterId, timestamp])  // Composite index for range queries
  @@index([timestamp])           // For time-based partitioning
}

// Hot Storage - Current state
model MeterCurrentState {
  meterId       String   @unique @map("meter_id")
  kwhConsumedAc Float    @map("kwh_consumed_ac")
  voltage       Float
  lastTimestamp DateTime @map("last_timestamp")
}
```

## API Endpoints

### Ingestion Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/ingestion/meter` | Ingest single meter reading |
| POST | `/v1/ingestion/vehicle` | Ingest single vehicle reading |
| POST | `/v1/ingestion/meter/batch` | Batch ingest meter readings |
| POST | `/v1/ingestion/vehicle/batch` | Batch ingest vehicle readings |
| PATCH | `/v1/ingestion/vehicle/:vehicleId/meter/:meterId` | Associate vehicle with meter |

### Analytics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/analytics/performance/:vehicleId` | 24-hour performance summary |
| GET | `/v1/analytics/current/:vehicleId` | Current vehicle state (hot storage) |
| GET | `/v1/analytics/fleet/stats` | Fleet-wide statistics |

### Example: Performance Summary Response

```json
{
  "vehicleId": "VEH-001",
  "meterId": "METER-001",
  "periodStart": "2024-01-14T10:30:00.000Z",
  "periodEnd": "2024-01-15T10:30:00.000Z",
  "totalAcConsumed": 125.5,
  "totalDcDelivered": 108.2,
  "efficiencyRatio": 86.2,
  "avgBatteryTemp": 32.5,
  "vehicleReadingCount": 1440,
  "meterReadingCount": 1440,
  "efficiencyStatus": "HEALTHY"
}
```

## Quick Start

### Using Docker Compose

```bash
# Clone the repository
git clone <repository-url>
cd energy-ingestion-engine

# Start services
docker-compose up -d

# The application will be available at:
# - API: http://localhost:3000
# - Swagger Docs: http://localhost:3000/api
```

### Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run start:dev
```

## Development

### Project Structure

```
src/
├── analytics/           # Analytics module
│   ├── dto/            # Response DTOs
│   ├── analytics.controller.ts
│   ├── analytics.service.ts
│   └── analytics.module.ts
├── ingestion/          # Ingestion module
│   ├── dto/            # Request DTOs with validation
│   ├── ingestion.controller.ts
│   ├── ingestion.service.ts
│   └── ingestion.module.ts
├── prisma/             # Database module
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── app.module.ts       # Root module
└── main.ts             # Application entry
```

### Scripts

```bash
npm run start:dev        # Development with watch mode
npm run build            # Production build
npm run start:prod       # Production start
npm run prisma:studio    # Prisma database GUI
npm run prisma:migrate   # Run migrations
npm run test             # Run unit tests
npm run test:e2e         # Run E2E tests
```

### Environment Variables

```env
DATABASE_URL=postgresql://energy:energy@localhost:5432/energy_db
PORT=3000
NODE_ENV=development
```

## Performance Considerations

### Query Optimization

The analytics endpoint avoids full table scans by:

1. **Using composite indexes**: Queries filter by `(vehicleId, timestamp)` which uses the index
2. **Bounded time ranges**: Always queries within a specific 24-hour window
3. **Hot storage lookups**: Current state queries use unique index for O(1) access

### Scaling Strategies

For production deployment with higher volumes:

1. **Table Partitioning**: Partition historical tables by month/week
2. **Read Replicas**: Route analytics queries to read replicas
3. **TimescaleDB**: Consider TimescaleDB extension for native time-series optimization
4. **Message Queue**: Add Kafka/RabbitMQ for ingestion buffering
5. **Horizontal Scaling**: Deploy multiple app instances behind load balancer

### Efficiency Thresholds

| Efficiency | Status | Indication |
|------------|--------|------------|
| ≥ 85% | HEALTHY | Normal operation |
| 75-85% | WARNING | Potential issues |
| < 75% | CRITICAL | Hardware fault likely |

## Testing

### Sample Ingestion Requests

**Meter Telemetry:**
```bash
curl -X POST http://localhost:3000/v1/ingestion/meter \
  -H "Content-Type: application/json" \
  -d '{
    "meterId": "METER-001",
    "kwhConsumedAc": 125.5,
    "voltage": 230.5,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }'
```

**Vehicle Telemetry:**
```bash
curl -X POST http://localhost:3000/v1/ingestion/vehicle \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "VEH-001",
    "soc": 75.5,
    "kwhDeliveredDc": 45.2,
    "batteryTemp": 35.0,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }'
```

**Associate Vehicle with Meter:**
```bash
curl -X PATCH http://localhost:3000/v1/ingestion/vehicle/VEH-001/meter/METER-001
```

**Get Performance Summary:**
```bash
curl http://localhost:3000/v1/analytics/performance/VEH-001
```

## License

This project is proprietary and confidential.
