/**
 * Account Deletion Cron Job
 * ==========================
 *
 * POST /api/cron/account-deletion - Process pending deletions
 * GET /api/cron/account-deletion - Get deletion queue status
 *
 * Schedule: Daily at 3:00 AM Buenos Aires time (6:00 UTC)
 *
 * This cron job:
 * 1. Processes confirmed deletions past the 30-day waiting period
 * 2. Sends reminder emails (7 days, 1 day before deletion)
 * 3. Logs all actions for audit purposes
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { accountDeletion } from '@/lib/services/account-deletion';
import { sendDeletionReminderEmail, sendDeletionCompleteEmail } from '@/lib/email/deletion-emails';

// Vercel Cron configuration
export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max

interface CronJobResult {
    success: boolean;
    deletionsProcessed: number;
    reminders7Day: number;
    reminders1Day: number;
    errors: Array<{ id: string; error: string }>;
    durationMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Process Pending Deletions
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
    const startTime = Date.now();
    const errors: Array<{ id: string; error: string }> = [];
    let deletionsProcessed = 0;
    let reminders7Day = 0;
    let reminders1Day = 0;

    console.log('[AccountDeletionCron] Starting account deletion processing...');

    try {
        // Verify cron secret if configured
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
            const authHeader = request.headers.get('authorization');
            if (authHeader !== `Bearer ${cronSecret}`) {
                console.warn('[AccountDeletionCron] Unauthorized request');
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        // 1. Send reminder emails (7 days before)
        console.log('[AccountDeletionCron] Checking 7-day reminders...');
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        sevenDaysFromNow.setHours(23, 59, 59, 999);

        const sixDaysFromNow = new Date();
        sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);
        sixDaysFromNow.setHours(0, 0, 0, 0);

        const sevenDayReminders = await prisma.$queryRaw<Array<{
            id: string;
            user_id: string;
            scheduled_deletion_at: Date;
        }>>`
      SELECT dr.id, dr.user_id, dr.scheduled_deletion_at
      FROM deletion_requests dr
      WHERE dr.status = 'confirmed'
      AND dr.scheduled_deletion_at BETWEEN ${sixDaysFromNow} AND ${sevenDaysFromNow}
      AND NOT EXISTS (
        SELECT 1 FROM subscription_events se
        WHERE se.event_type = 'deletion_reminder_7day'
        AND se.metadata->>'deletionRequestId' = dr.id::text
      )
    `;

        for (const reminder of sevenDayReminders) {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: reminder.user_id },
                    select: { email: true, name: true },
                });

                if (user?.email) {
                    await sendDeletionReminderEmail(
                        user.email,
                        user.name,
                        reminder.scheduled_deletion_at,
                        7
                    );

                    // Log that we sent this reminder
                    await prisma.subscriptionEvent.create({
                        data: {
                            organizationId: 'system',
                            eventType: 'deletion_reminder_7day',
                            description: `7-day deletion reminder sent to ${user.email}`,
                            metadata: { deletionRequestId: reminder.id, userId: reminder.user_id },
                        },
                    });

                    reminders7Day++;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push({ id: reminder.id, error: `7-day reminder failed: ${errorMessage}` });
            }
        }

        // 2. Send reminder emails (1 day before)
        console.log('[AccountDeletionCron] Checking 1-day reminders...');
        const oneDayFromNow = new Date();
        oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
        oneDayFromNow.setHours(23, 59, 59, 999);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const oneDayReminders = await prisma.$queryRaw<Array<{
            id: string;
            user_id: string;
            scheduled_deletion_at: Date;
        }>>`
      SELECT dr.id, dr.user_id, dr.scheduled_deletion_at
      FROM deletion_requests dr
      WHERE dr.status = 'confirmed'
      AND dr.scheduled_deletion_at BETWEEN ${today} AND ${oneDayFromNow}
      AND NOT EXISTS (
        SELECT 1 FROM subscription_events se
        WHERE se.event_type = 'deletion_reminder_1day'
        AND se.metadata->>'deletionRequestId' = dr.id::text
      )
    `;

        for (const reminder of oneDayReminders) {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: reminder.user_id },
                    select: { email: true, name: true },
                });

                if (user?.email) {
                    await sendDeletionReminderEmail(
                        user.email,
                        user.name,
                        reminder.scheduled_deletion_at,
                        1
                    );

                    await prisma.subscriptionEvent.create({
                        data: {
                            organizationId: 'system',
                            eventType: 'deletion_reminder_1day',
                            description: `1-day deletion reminder sent to ${user.email}`,
                            metadata: { deletionRequestId: reminder.id, userId: reminder.user_id },
                        },
                    });

                    reminders1Day++;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                errors.push({ id: reminder.id, error: `1-day reminder failed: ${errorMessage}` });
            }
        }

        // 3. Process actual deletions
        console.log('[AccountDeletionCron] Processing pending deletions...');

        // Get users scheduled for deletion today or earlier
        const pendingDeletions = await prisma.$queryRaw<Array<{
            id: string;
            user_id: string;
            org_id: string;
        }>>`
      SELECT id, user_id, org_id
      FROM deletion_requests
      WHERE status = 'confirmed'
      AND scheduled_deletion_at <= NOW()
    `;

        for (const deletion of pendingDeletions) {
            try {
                // Get user email before deletion
                const user = await prisma.user.findUnique({
                    where: { id: deletion.user_id },
                    select: { email: true, name: true },
                });

                // Mark as processing
                await prisma.$executeRaw`
          UPDATE deletion_requests
          SET status = 'processing'
          WHERE id = ${deletion.id}::uuid
        `;

                // Execute deletion (uses the existing account-deletion service)
                const result = await accountDeletion.processPendingDeletions();

                if (result.processed > 0) {
                    deletionsProcessed++;

                    // Send completion email
                    if (user?.email) {
                        try {
                            await sendDeletionCompleteEmail(
                                user.email,
                                user.name,
                                ['Datos personales', 'Fotos subidas', 'Documentos', 'Preferencias de privacidad'],
                                ['Facturas (10 años)', 'Registros de auditoría (5 años)'],
                                'La ley argentina (AFIP y Ley 25.326) requiere conservar ciertos registros comerciales y de auditoría por períodos específicos.'
                            );
                        } catch (emailError) {
                            console.error('Failed to send deletion complete email:', emailError);
                        }
                    }
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`[AccountDeletionCron] Error processing deletion ${deletion.id}:`, error);
                errors.push({ id: deletion.id, error: errorMessage });
            }
        }

        const result: CronJobResult = {
            success: errors.length === 0,
            deletionsProcessed,
            reminders7Day,
            reminders1Day,
            errors,
            durationMs: Date.now() - startTime,
        };

        // Log the cron execution
        await prisma.subscriptionEvent.create({
            data: {
                organizationId: 'system',
                eventType: 'cron_account_deletion',
                description: `Account deletion cron: ${deletionsProcessed} deleted, ${reminders7Day + reminders1Day} reminders`,
                metadata: result,
            },
        });

        console.log(`[AccountDeletionCron] Complete. Deleted: ${deletionsProcessed}, Reminders: ${reminders7Day + reminders1Day}`);

        return NextResponse.json(result);
    } catch (error) {
        console.error('[AccountDeletionCron] Fatal error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                durationMs: Date.now() - startTime,
            },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Deletion Queue Status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(): Promise<NextResponse> {
    try {
        const now = new Date();

        const [pending, confirmed, processing, completed, cancelled] = await Promise.all([
            prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) FROM deletion_requests WHERE status = 'pending'
      `,
            prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) FROM deletion_requests WHERE status = 'confirmed'
      `,
            prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) FROM deletion_requests WHERE status = 'processing'
      `,
            prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) FROM deletion_requests WHERE status = 'completed'
      `,
            prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) FROM deletion_requests WHERE status = 'cancelled'
      `,
        ]);

        // Get next scheduled deletion
        const nextDeletion = await prisma.$queryRaw<Array<{
            scheduled_deletion_at: Date;
            user_id: string;
        }>>`
      SELECT scheduled_deletion_at, user_id
      FROM deletion_requests
      WHERE status = 'confirmed'
      ORDER BY scheduled_deletion_at ASC
      LIMIT 1
    `;

        // Get last cron run
        const lastRun = await prisma.subscriptionEvent.findFirst({
            where: {
                organizationId: 'system',
                eventType: 'cron_account_deletion',
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true, metadata: true },
        });

        return NextResponse.json({
            success: true,
            status: {
                pending: Number(pending[0].count),
                confirmed: Number(confirmed[0].count),
                processing: Number(processing[0].count),
                completed: Number(completed[0].count),
                cancelled: Number(cancelled[0].count),
            },
            nextDeletion: nextDeletion.length > 0 ? {
                scheduledAt: nextDeletion[0].scheduled_deletion_at.toISOString(),
                userId: nextDeletion[0].user_id,
            } : null,
            lastRun: lastRun ? {
                at: lastRun.createdAt.toISOString(),
                result: lastRun.metadata,
            } : null,
            checkedAt: now.toISOString(),
        });
    } catch (error) {
        console.error('[AccountDeletionCron] Status check error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
