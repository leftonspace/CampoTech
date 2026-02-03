/**
 * Customer Confirmation Code Service
 * ===================================
 * 
 * Phase 4.4: Customer Verification System
 * 
 * Provides a Rappi/Uber-style confirmation code system where:
 * 1. Customer receives a 4-digit code via WhatsApp when technician is en route
 * 2. Technician must enter this code to confirm arrival
 * 3. Customer receives confirmation that job has started
 * 
 * This creates trust and accountability for both parties.
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConfirmationCodeResult {
    success: boolean;
    code?: string;
    error?: string;
    sentAt?: Date;
}

export interface CodeVerificationResult {
    success: boolean;
    verified: boolean;
    error?: string;
    attemptsRemaining?: number;
}

interface JobWithCustomer {
    id: string;
    jobNumber: string;
    customer: {
        name: string;
        phone: string;
    };
    organization: {
        name: string;
        phone: string | null;
        confirmationCodeEnabled: boolean;
    };
    technician?: {
        name: string;
    } | null;
    scheduledDate: Date | null;
    scheduledTimeSlot: unknown;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ConfirmationCodeService {
    private static readonly CODE_LENGTH = 4;
    private static readonly MAX_ATTEMPTS = 3;

    /**
     * Generate and send a confirmation code to the customer
     * Called when technician starts navigation to a job
     */
    async generateAndSendCode(jobId: string): Promise<ConfirmationCodeResult> {
        try {
            // Get job with customer and organization details
            const job = await prisma.job.findUnique({
                where: { id: jobId },
                include: {
                    customer: {
                        select: { name: true, phone: true }
                    },
                    organization: {
                        select: {
                            name: true,
                            phone: true
                        }
                    },
                    technician: {
                        select: { name: true }
                    }
                }
            });

            if (!job) {
                return { success: false, error: 'Job not found' };
            }

            // Confirmation codes are MANDATORY for all jobs (platform security feature)
            // No organization toggle - this is always required

            // Check if customer has a phone number
            if (!job.customer.phone) {
                return { success: false, error: 'Customer does not have a phone number' };
            }

            // Generate a 4-digit code
            const code = this.generateCode();

            // Store the code in the database
            await prisma.job.update({
                where: { id: jobId },
                data: {
                    confirmationCode: code,
                    confirmationCodeSentAt: new Date(),
                    confirmationCodeVerifiedAt: null,
                    confirmationCodeAttempts: 0
                }
            });

            // Send WhatsApp message to customer
            await this.sendCodeToCustomer(job as unknown as JobWithCustomer, code);

            return {
                success: true,
                code,
                sentAt: new Date()
            };
        } catch (error) {
            console.error('Error generating confirmation code:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Verify the code entered by the technician
     */
    async verifyCode(jobId: string, enteredCode: string): Promise<CodeVerificationResult> {
        try {
            const job = await prisma.job.findUnique({
                where: { id: jobId },
                include: {
                    customer: {
                        select: { name: true, phone: true }
                    },
                    organization: {
                        select: { name: true, phone: true }
                    },
                    technician: {
                        select: { name: true }
                    }
                }
            });

            if (!job) {
                return { success: false, verified: false, error: 'Job not found' };
            }

            if (!job.confirmationCode) {
                return { success: false, verified: false, error: 'No confirmation code was sent for this job' };
            }

            // Check if already verified
            if (job.confirmationCodeVerifiedAt) {
                return { success: true, verified: true };
            }

            // Check attempts
            if (job.confirmationCodeAttempts >= ConfirmationCodeService.MAX_ATTEMPTS) {
                return {
                    success: false,
                    verified: false,
                    error: 'Maximum attempts exceeded. Please contact the customer directly.',
                    attemptsRemaining: 0
                };
            }

            // Verify the code (case-insensitive)
            const isValid = job.confirmationCode.toUpperCase() === enteredCode.toUpperCase().trim();

            if (isValid) {
                // Mark as verified
                await prisma.job.update({
                    where: { id: jobId },
                    data: {
                        confirmationCodeVerifiedAt: new Date()
                    }
                });

                // Send confirmation to customer
                await this.sendConfirmationToCustomer(job as unknown as JobWithCustomer);

                return { success: true, verified: true };
            } else {
                // Increment attempts
                const newAttempts = job.confirmationCodeAttempts + 1;
                await prisma.job.update({
                    where: { id: jobId },
                    data: {
                        confirmationCodeAttempts: newAttempts
                    }
                });

                return {
                    success: false,
                    verified: false,
                    error: 'Incorrect code',
                    attemptsRemaining: ConfirmationCodeService.MAX_ATTEMPTS - newAttempts
                };
            }
        } catch (error) {
            console.error('Error verifying confirmation code:', error);
            return {
                success: false,
                verified: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Check if a job requires confirmation code entry
     */
    async checkCodeStatus(jobId: string): Promise<{
        codeRequired: boolean;
        codeSent: boolean;
        codeVerified: boolean;
        attemptsRemaining: number;
    }> {
        const job = await prisma.job.findUnique({
            where: { id: jobId }
        });

        if (!job) {
            return {
                codeRequired: true, // Always required
                codeSent: false,
                codeVerified: false,
                attemptsRemaining: 0
            };
        }

        return {
            codeRequired: true, // Always required - platform security feature
            codeSent: !!job.confirmationCodeSentAt,
            codeVerified: !!job.confirmationCodeVerifiedAt,
            attemptsRemaining: Math.max(0, ConfirmationCodeService.MAX_ATTEMPTS - job.confirmationCodeAttempts)
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * Generate a random 4-digit code
     */
    private generateCode(): string {
        // Generate 4 random digits
        const randomBytes = crypto.randomBytes(2);
        const number = (randomBytes.readUInt16BE(0) % 9000) + 1000; // 1000-9999
        return number.toString();
    }

    /**
     * Send the confirmation code to the customer via WhatsApp
     */
    private async sendCodeToCustomer(job: JobWithCustomer, code: string): Promise<void> {
        // Format scheduled time if available
        let timeText = '';
        if (job.scheduledDate) {
            const dateStr = format(job.scheduledDate, "EEEE d 'de' MMMM", { locale: es });
            const timeSlot = job.scheduledTimeSlot as { start?: string; end?: string } | null;
            if (timeSlot?.start) {
                timeText = ` para ${dateStr} a las ${timeSlot.start}`;
            } else {
                timeText = ` para ${dateStr}`;
            }
        }

        const technicianName = job.technician?.name || 'nuestro técnico';

        // Create the WhatsApp message
        const message = `Hola ${job.customer.name}! 👋

${technicianName} de ${job.organization.name} está en camino${timeText}.

Tu código de confirmación es:
🔐 *${code}*

Pedíselo al técnico cuando llegue para confirmar su identidad.

Trabajo #${job.jobNumber}`;

        // Queue the WhatsApp message
        await prisma.waOutboundQueue.create({
            data: {
                phone: this.normalizePhone(job.customer.phone),
                message,
                organizationId: (job as unknown as { organizationId: string }).organizationId,
                priority: 'high',
                metadata: {
                    type: 'confirmation_code',
                    jobId: job.id,
                    jobNumber: job.jobNumber
                }
            }
        });
    }

    /**
     * Send a confirmation message to the customer after code verification
     */
    private async sendConfirmationToCustomer(job: JobWithCustomer): Promise<void> {
        const technicianName = job.technician?.name || 'El técnico';

        const message = `✅ *Confirmado!*

${technicianName} ha llegado y comenzó el trabajo #${job.jobNumber}.

Si tenés alguna consulta, contactá a ${job.organization.name}${job.organization.phone ? ` al ${job.organization.phone}` : ''}.`;

        // Queue the WhatsApp message
        await prisma.waOutboundQueue.create({
            data: {
                phone: this.normalizePhone(job.customer.phone),
                message,
                organizationId: (job as unknown as { organizationId: string }).organizationId,
                priority: 'normal',
                metadata: {
                    type: 'confirmation_verified',
                    jobId: job.id,
                    jobNumber: job.jobNumber
                }
            }
        });
    }

    /**
     * Normalize phone number for WhatsApp (ensure +54 prefix)
     */
    private normalizePhone(phone: string): string {
        // Remove any non-digit characters except +
        let cleaned = phone.replace(/[^\d+]/g, '');

        // Add Argentina country code if not present
        if (!cleaned.startsWith('+')) {
            if (cleaned.startsWith('54')) {
                cleaned = '+' + cleaned;
            } else {
                cleaned = '+54' + cleaned;
            }
        }

        return cleaned;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let confirmationCodeServiceInstance: ConfirmationCodeService | null = null;

export function getConfirmationCodeService(): ConfirmationCodeService {
    if (!confirmationCodeServiceInstance) {
        confirmationCodeServiceInstance = new ConfirmationCodeService();
    }
    return confirmationCodeServiceInstance;
}

export default ConfirmationCodeService;
