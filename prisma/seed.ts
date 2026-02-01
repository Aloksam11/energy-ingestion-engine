import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create sample meters
  const meters = await Promise.all([
    prisma.meter.upsert({
      where: { meterId: 'METER-001' },
      update: {},
      create: {
        meterId: 'METER-001',
        name: 'Main Charging Station Meter',
        location: 'Parking Lot A',
      },
    }),
    prisma.meter.upsert({
      where: { meterId: 'METER-002' },
      update: {},
      create: {
        meterId: 'METER-002',
        name: 'Secondary Charging Station Meter',
        location: 'Parking Lot B',
      },
    }),
  ]);

  console.log(`Created ${meters.length} meters`);

  // Create sample vehicles
  const vehicles = await Promise.all([
    prisma.vehicle.upsert({
      where: { vehicleId: 'VEH-001' },
      update: {},
      create: {
        vehicleId: 'VEH-001',
        name: 'Tesla Model 3 #001',
        batteryCapacity: 75,
        meterId: 'METER-001',
      },
    }),
    prisma.vehicle.upsert({
      where: { vehicleId: 'VEH-002' },
      update: {},
      create: {
        vehicleId: 'VEH-002',
        name: 'Tesla Model Y #002',
        batteryCapacity: 82,
        meterId: 'METER-001',
      },
    }),
    prisma.vehicle.upsert({
      where: { vehicleId: 'VEH-003' },
      update: {},
      create: {
        vehicleId: 'VEH-003',
        name: 'Rivian R1T #003',
        batteryCapacity: 135,
        meterId: 'METER-002',
      },
    }),
  ]);

  console.log(`Created ${vehicles.length} vehicles`);

  // Generate sample readings for the last 24 hours
  const now = new Date();
  const readings: any[] = [];

  for (let i = 0; i < 24 * 60; i++) {
    // One reading per minute
    const timestamp = new Date(now.getTime() - i * 60 * 1000);

    // Meter readings (cumulative kWh)
    readings.push(
      prisma.meterReading.create({
        data: {
          meterId: 'METER-001',
          kwhConsumedAc: 1000 + i * 0.5 + Math.random() * 0.1,
          voltage: 230 + Math.random() * 5,
          timestamp,
        },
      }),
    );

    // Vehicle readings
    readings.push(
      prisma.vehicleReading.create({
        data: {
          vehicleId: 'VEH-001',
          soc: 20 + (i / (24 * 60)) * 60 + Math.random() * 2,
          kwhDeliveredDc: 800 + i * 0.42 + Math.random() * 0.1, // ~84% efficiency
          batteryTemp: 30 + Math.random() * 5,
          timestamp,
        },
      }),
    );
  }

  // Batch create readings
  console.log(`Creating ${readings.length} readings...`);
  await Promise.all(readings);

  // Update current state
  await prisma.meterCurrentState.upsert({
    where: { meterId: 'METER-001' },
    update: {
      kwhConsumedAc: 1000 + 24 * 60 * 0.5,
      voltage: 232,
      lastTimestamp: now,
    },
    create: {
      meterId: 'METER-001',
      kwhConsumedAc: 1000 + 24 * 60 * 0.5,
      voltage: 232,
      lastTimestamp: now,
    },
  });

  await prisma.vehicleCurrentState.upsert({
    where: { vehicleId: 'VEH-001' },
    update: {
      soc: 80,
      kwhDeliveredDc: 800 + 24 * 60 * 0.42,
      batteryTemp: 32,
      lastTimestamp: now,
    },
    create: {
      vehicleId: 'VEH-001',
      soc: 80,
      kwhDeliveredDc: 800 + 24 * 60 * 0.42,
      batteryTemp: 32,
      lastTimestamp: now,
    },
  });

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
