/**
 * Test Payment Flow Script
 * ========================
 * 
 * Simulates the mobile payment flow for testing.
 * 
 * Run with: npx tsx scripts/test-payment-flow.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPaymentFlow() {
    console.log('🧪 Testing Payment Flow...\n');

    // Get required entities
    const customer = await prisma.customer.findFirst();
    const user = await prisma.user.findFirst();
    const org = await prisma.organization.findFirst();

    if (!customer || !user || !org) {
        console.log('❌ Need at least one customer, user, and organization in the database.');
        return;
    }

    console.log('📦 Creating test job with line items...');

    const testJob = await prisma.job.create({
        data: {
            jobNumber: `TEST-PAY-${Date.now()}`,
            serviceType: 'OTRO',
            serviceTypeCode: 'MANTENIMIENTO_GENERAL',
            description: 'Test job for payment flow - full test with materials',
            status: 'IN_PROGRESS',
            urgency: 'NORMAL',
            customerId: customer.id,
            technicianId: user.id,
            createdById: user.id,
            organizationId: org.id,
            startedAt: new Date(),
        },
        include: {
            customer: true,
            technician: true,
        },
    });

    console.log(`✅ Created test job: ${testJob.jobNumber}`);
    console.log(`   Customer: ${testJob.customer.name}`);
    console.log(`   Technician: ${testJob.technician?.name}`);

    // Add realistic line items one by one (with all required fields)
    const lineItemsData = [
        {
            description: 'Mano de obra - Instalación (2 horas)',
            quantity: 2,
            unitPrice: 12500,
        },
        {
            description: 'Termostato digital programable',
            quantity: 1,
            unitPrice: 45000,
        },
        {
            description: 'Insumos varios (cables, sellador, cinta)',
            quantity: 1,
            unitPrice: 8500,
        },
    ];

    for (const item of lineItemsData) {
        const total = item.quantity * item.unitPrice;
        await prisma.jobLineItem.create({
            data: {
                jobId: testJob.id,
                description: item.description,
                quantity: item.quantity,
                unit: 'unidad',
                unitPrice: item.unitPrice,
                total: total,
                taxRate: 21,
                source: 'TECH_ADDED',
                createdById: user.id,
            },
        });
    }

    console.log('   Added 3 line items (labor + 2 materials)');
    return testPaymentFlowWithJob(testJob.id);
}

async function testPaymentFlowWithJob(jobId: string) {
    console.log('\n═══════════════════════════════════════════════');
    console.log('        STEP 4: COBRO (PAYMENT COLLECTION)      ');
    console.log('═══════════════════════════════════════════════\n');

    // Calculate total (like the mobile app does)
    const lineItems = await prisma.jobLineItem.findMany({
        where: { jobId },
    });

    type JobLineItemResult = Awaited<ReturnType<typeof prisma.jobLineItem.findMany>>[number];
    const subtotal = lineItems.reduce(
        (sum: number, item: JobLineItemResult) => sum + Number(item.quantity) * Number(item.unitPrice),
        0
    );
    const tax = subtotal * 0.21;
    const total = subtotal + tax;

    console.log('📄 RESUMEN DE FACTURA:');
    console.log('─────────────────────────────────────────────────');
    lineItems.forEach((item: JobLineItemResult) => {
        const lineTotal = Number(item.quantity) * Number(item.unitPrice);
        console.log(`  ${item.description}`);
        console.log(`    ${item.quantity} x $${Number(item.unitPrice).toLocaleString('es-AR')} = $${lineTotal.toLocaleString('es-AR')}`);
    });
    console.log('─────────────────────────────────────────────────');
    console.log(`  Subtotal:  $${subtotal.toLocaleString('es-AR')}`);
    console.log(`  IVA (21%): $${tax.toLocaleString('es-AR')}`);
    console.log(`  ═══════════════════════════════════════════════`);
    console.log(`  💰 TOTAL:  $${total.toLocaleString('es-AR')}`);
    console.log('');

    // Simulate payment method selection
    console.log('🔘 MÉTODO DE PAGO: EFECTIVO');
    console.log(`   Monto recibido: $${total.toLocaleString('es-AR')}`);
    console.log('   ✓ Monto completo\n');

    // Simulate Cash Payment
    console.log('⏳ Procesando pago...');

    const technician = await prisma.user.findFirst();

    const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            paymentMethod: 'CASH',
            paymentAmount: total,
            paymentCollectedAt: new Date(),
            paymentCollectedById: technician?.id,
            resolution: 'Instalación de termostato completada. Cliente satisfecho.',
            finalTotal: total,
        },
    });

    console.log('\n✅ ¡TRABAJO COMPLETADO CON COBRO!');
    console.log('═══════════════════════════════════════════════\n');

    // Summary
    console.log('📋 Resumen de la operación:');
    console.log(`   Número de trabajo: ${updatedJob.jobNumber}`);
    console.log(`   Estado: ${updatedJob.status}`);
    console.log(`   Método de pago: ${updatedJob.paymentMethod}`);
    console.log(`   Monto cobrado: $${Number(updatedJob.paymentAmount).toLocaleString('es-AR')}`);
    console.log(`   Hora de cobro: ${updatedJob.paymentCollectedAt?.toLocaleString('es-AR')}`);
    console.log(`   Trabajo completado: ${updatedJob.completedAt?.toLocaleString('es-AR')}`);

    // Simulate what would happen next
    console.log('\n📱 Próximos pasos automáticos:');
    console.log('   → Enviar reporte PDF por WhatsApp');
    console.log('   → Enviar factura PDF por WhatsApp');
    console.log('   → Enviar link de calificación');

    // Verify the update
    const verification = await prisma.job.findUnique({
        where: { id: jobId },
        select: {
            jobNumber: true,
            status: true,
            paymentMethod: true,
            paymentAmount: true,
            paymentCollectedAt: true,
            paymentCollectedById: true,
            completedAt: true,
            finalTotal: true,
        },
    });

    console.log('\n📊 Datos guardados en DB:');
    console.log(JSON.stringify(verification, null, 2));

    console.log('\n🎉 Test completado exitosamente!');
    console.log('   → Revisa el trabajo en Prisma Studio: http://localhost:5555');
    console.log('   → O en el dashboard web: http://localhost:3000/dashboard/jobs');
}

testPaymentFlow()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
