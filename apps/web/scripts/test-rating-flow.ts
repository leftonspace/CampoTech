/**
 * Test Rating Flow Script
 * =======================
 * 
 * Creates a test review record with a rating token so you can test the rating page.
 * 
 * Usage:
 *   npx tsx scripts/test-rating-flow.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🧪 Testing Rating Flow\n');
    console.log('='.repeat(60));

    // Use raw SQL to find a job - more reliable
    const jobs = await prisma.$queryRaw<Array<{
        id: string;
        job_number: string;
        status: string;
        organization_id: string;
        customer_id: string | null;
        technician_id: string | null;
        customer_name: string | null;
        org_name: string | null;
    }>>`
    SELECT 
      j.id,
      j."jobNumber" as job_number,
      j.status::text,
      j."organizationId" as organization_id,
      j."customerId" as customer_id,
      j."technicianId" as technician_id,
      c.name as customer_name,
      o.name as org_name
    FROM jobs j
    LEFT JOIN customers c ON j."customerId" = c.id
    LEFT JOIN organizations o ON j."organizationId" = o.id
    WHERE j."customerId" IS NOT NULL
    ORDER BY j."createdAt" DESC
    LIMIT 1
  `;

    if (jobs.length === 0) {
        console.log('❌ No jobs found with customers. Please create a job first.');
        return;
    }

    const job = jobs[0];
    console.log(`✅ Found job: #${job.job_number} (status: ${job.status})`);
    console.log(`   Customer: ${job.customer_name || 'Unknown'}`);
    console.log(`   Organization: ${job.org_name || 'Unknown'}`);

    // Check if review already exists for this job
    const existingReviews = await prisma.$queryRaw<Array<{
        id: string;
        rating: number | null;
        token: string | null;
    }>>`
    SELECT id, rating, token FROM reviews WHERE "jobId" = ${job.id} LIMIT 1
  `;

    let ratingToken: string;

    if (existingReviews.length > 0) {
        const existingReview = existingReviews[0];
        if (existingReview.rating !== null) {
            console.log(`\n⚠️  This job already has a rating: ${existingReview.rating} stars`);
            console.log('   Creating a NEW review record for testing...\n');

            // Create new review without job link (for testing purposes)
            ratingToken = randomUUID();
            await prisma.$executeRaw`
        INSERT INTO reviews (id, "organizationId", "customerId", "technicianId", token, "tokenExpiresAt", "createdAt", "updatedAt")
        VALUES (
          ${randomUUID()},
          ${job.organization_id},
          ${job.customer_id},
          ${job.technician_id},
          ${ratingToken},
          ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)},
          NOW(),
          NOW()
        )
      `;
        } else {
            // Has review but no rating yet - use existing token
            if (existingReview.token) {
                ratingToken = existingReview.token;
                console.log('\n✅ Using existing review token (not yet rated)');
            } else {
                // Update with new token
                ratingToken = randomUUID();
                await prisma.$executeRaw`
          UPDATE reviews 
          SET token = ${ratingToken}, "tokenExpiresAt" = ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
          WHERE id = ${existingReview.id}
        `;
                console.log('\n✅ Updated existing review with new token');
            }
        }
    } else {
        // Create new review
        ratingToken = randomUUID();
        await prisma.$executeRaw`
      INSERT INTO reviews (id, "jobId", "organizationId", "customerId", "technicianId", token, "tokenExpiresAt", "createdAt", "updatedAt")
      VALUES (
        ${randomUUID()},
        ${job.id},
        ${job.organization_id},
        ${job.customer_id},
        ${job.technician_id},
        ${ratingToken},
        ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)},
        NOW(),
        NOW()
      )
    `;
        console.log('\n✅ Created new review record');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n🔗 TEST THE RATING PAGE:');
    console.log('\n   http://localhost:3000/rate/' + ratingToken);
    console.log('\n' + '='.repeat(60));

    console.log('\n📋 Expected behavior:');
    console.log('   1. Page shows star rating form (1-5 stars)');
    console.log('   2. Optional comment field');
    console.log('   3. Submit button saves the rating');
    console.log('   4. Success message with "Save WhatsApp" prompt');

    console.log('\n📊 After submitting, check rating in:');
    console.log('   - Dashboard Customers page: http://localhost:3000/dashboard/customers');
    console.log('   - Customer Profile Modal → Rating displayed\n');
}

main()
    .catch((e) => {
        console.error('Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
