import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create organization
  const org = await prisma.organization.upsert({
    where: { id: 'org-demo-001' },
    update: {},
    create: {
      id: 'org-demo-001',
      name: 'CampoTech Demo',
      phone: '+5491112345678',
      email: 'demo@campotech.com.ar',
      settings: {
        defaultScheduleStart: '08:00',
        defaultScheduleEnd: '18:00',
      },
    },
  });

  console.log('✅ Organization created:', org.name);

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@campotech.com.ar' },
    update: {},
    create: {
      email: 'admin@campotech.com.ar',
      phone: '+5491112345678',
      name: 'Admin Demo',
      passwordHash: adminPassword,
      role: 'ADMIN',
      organizationId: org.id,
    },
  });

  const technician1 = await prisma.user.upsert({
    where: { email: 'tecnico1@campotech.com.ar' },
    update: {},
    create: {
      email: 'tecnico1@campotech.com.ar',
      phone: '+5491198765432',
      name: 'Juan Técnico',
      passwordHash: adminPassword,
      role: 'TECHNICIAN',
      organizationId: org.id,
    },
  });

  const technician2 = await prisma.user.upsert({
    where: { email: 'tecnico2@campotech.com.ar' },
    update: {},
    create: {
      email: 'tecnico2@campotech.com.ar',
      phone: '+5491155556666',
      name: 'María Técnica',
      passwordHash: adminPassword,
      role: 'TECHNICIAN',
      organizationId: org.id,
    },
  });

  console.log('✅ Users created:', admin.name, technician1.name, technician2.name);

  // Create customers
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: 'cust-001' },
      update: {},
      create: {
        id: 'cust-001',
        name: 'María García',
        phone: '+5491144445555',
        email: 'maria@email.com',
        address: {
          street: 'Av. Santa Fe',
          number: '1234',
          floor: '5',
          apartment: 'A',
          neighborhood: 'Palermo',
          city: 'Buenos Aires',
          postalCode: '1425',
        },
        organizationId: org.id,
      },
    }),
    prisma.customer.upsert({
      where: { id: 'cust-002' },
      update: {},
      create: {
        id: 'cust-002',
        name: 'Carlos Rodríguez',
        phone: '+5491166667777',
        email: 'carlos@email.com',
        address: {
          street: 'Calle Florida',
          number: '567',
          neighborhood: 'Microcentro',
          city: 'Buenos Aires',
          postalCode: '1005',
        },
        organizationId: org.id,
      },
    }),
    prisma.customer.upsert({
      where: { id: 'cust-003' },
      update: {},
      create: {
        id: 'cust-003',
        name: 'Ana Martínez',
        phone: '+5491177778888',
        email: 'ana@email.com',
        address: {
          street: 'Av. Corrientes',
          number: '3456',
          floor: '2',
          apartment: 'B',
          neighborhood: 'Almagro',
          city: 'Buenos Aires',
          postalCode: '1194',
        },
        organizationId: org.id,
      },
    }),
  ]);

  console.log('✅ Customers created:', customers.length);

  // Create jobs
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const jobs = await Promise.all([
    prisma.job.upsert({
      where: { jobNumber: 'JOB-00001' },
      update: {},
      create: {
        jobNumber: 'JOB-00001',
        serviceType: 'INSTALACION_SPLIT',
        description: 'Instalación de split 3000 frigorías en dormitorio principal',
        status: 'ASSIGNED',
        urgency: 'NORMAL',
        scheduledDate: today,
        scheduledTimeSlot: { start: '09:00', end: '12:00' },
        customerId: customers[0].id,
        technicianId: technician1.id,
        createdById: admin.id,
        organizationId: org.id,
      },
    }),
    prisma.job.upsert({
      where: { jobNumber: 'JOB-00002' },
      update: {},
      create: {
        jobNumber: 'JOB-00002',
        serviceType: 'REPARACION_SPLIT',
        description: 'El aire acondicionado no enfría correctamente. Hace ruido extraño.',
        status: 'PENDING',
        urgency: 'URGENTE',
        scheduledDate: today,
        scheduledTimeSlot: { start: '14:00', end: '16:00' },
        customerId: customers[1].id,
        createdById: admin.id,
        organizationId: org.id,
      },
    }),
    prisma.job.upsert({
      where: { jobNumber: 'JOB-00003' },
      update: {},
      create: {
        jobNumber: 'JOB-00003',
        serviceType: 'MANTENIMIENTO_SPLIT',
        description: 'Mantenimiento preventivo anual. Limpieza de filtros y carga de gas si es necesario.',
        status: 'ASSIGNED',
        urgency: 'NORMAL',
        scheduledDate: tomorrow,
        scheduledTimeSlot: { start: '10:00', end: '11:30' },
        customerId: customers[2].id,
        technicianId: technician2.id,
        createdById: admin.id,
        organizationId: org.id,
      },
    }),
    prisma.job.upsert({
      where: { jobNumber: 'JOB-00004' },
      update: {},
      create: {
        jobNumber: 'JOB-00004',
        serviceType: 'INSTALACION_CALEFACTOR',
        description: 'Instalación de calefactor a gas en living',
        status: 'PENDING',
        urgency: 'NORMAL',
        scheduledDate: dayAfter,
        customerId: customers[0].id,
        createdById: admin.id,
        organizationId: org.id,
      },
    }),
    prisma.job.upsert({
      where: { jobNumber: 'JOB-00005' },
      update: {},
      create: {
        jobNumber: 'JOB-00005',
        serviceType: 'REPARACION_SPLIT',
        description: 'Revisión post-instalación. Cliente reporta goteo.',
        status: 'COMPLETED',
        urgency: 'NORMAL',
        scheduledDate: new Date(today.getTime() - 24 * 60 * 60 * 1000), // Yesterday
        completedAt: new Date(today.getTime() - 20 * 60 * 60 * 1000),
        resolution: 'Se ajustó el drenaje y se verificó el correcto funcionamiento. Sin costo adicional por garantía.',
        customerId: customers[1].id,
        technicianId: technician1.id,
        createdById: admin.id,
        organizationId: org.id,
      },
    }),
  ]);

  console.log('✅ Jobs created:', jobs.length);

  console.log('\n🎉 Seeding completed!');
  console.log('\n📋 Test credentials:');
  console.log('   Phone: +5491112345678 (Admin)');
  console.log('   Phone: +5491198765432 (Technician)');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
