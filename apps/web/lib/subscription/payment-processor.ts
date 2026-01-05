/**
 * Payment Processor
 * =================
 * 
 * Handles payment processing for subscriptions using MercadoPago.
 * 
 * Features:
 * - Process approved/failed payments
 * - Handle refunds with Ley 24.240 compliance (10-day refund period)
 * - Automatic subscription activation/cancellation
 * - Block management based on payment status
 */

import { prisma } from '@/lib/prisma';
// import { mercadoPagoClient } from '@/lib/integrations/mercadopago/client';
// FIXME: Implement mercadoPagoClient module

// Constants
export const LEY_24240_REFUND_DAYS = 10; // Argentine consumer protection law

// Types
export interface PaymentResult {
    success: boolean;
    error?: string;
    paymentId?: string;
}

export interface RefundResult {
    success: boolean;
    error?: string;
    refundAmount?: number;
    isLey24240Refund?: boolean;
}

export interface RefundEligibility {
    eligible: boolean;
    daysRemaining: number;
    isLey24240: boolean;
    reason?: string;
}

export interface PaymentData {
    organizationId: string;
    subscriptionId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
}

/**
 * Payment Processor Class
 */
class PaymentProcessor {
    /**
     * Process an approved payment
     */
    async processApprovedPayment(
        paymentId: string,
        paymentDetails: {
            mercadoPagoPaymentId: string;
            amount: number;
        }
    ): Promise<PaymentResult> {
        try {
            // Get payment record
            const payment = await prisma.subscriptionPayment.findUnique({
                where: { id: paymentId },
            });

            if (!payment) {
                return {
                    success: false,
                    error: 'Payment not found',
                };
            }

            // Check if already processed
            if (payment.status === 'completed') {
                return {
                    success: false,
                    error: 'Payment already processed',
                };
            }

            // Get organization
            const org = await prisma.organization.findUnique({
                where: { id: payment.organizationId },
            });

            if (!org) {
                return {
                    success: false,
                    error: 'Organization not found',
                };
            }

            // Process payment in transaction
            await prisma.$transaction(async (tx) => {
                // Update payment record
                await tx.subscriptionPayment.update({
                    where: { id: paymentId },
                    data: {
                        status: 'completed',
                        paidAt: new Date(),
                        mercadoPagoPaymentId: paymentDetails.mercadoPagoPaymentId,
                    },
                });

                // Activate subscription and remove blocks
                await tx.organization.update({
                    where: { id: payment.organizationId },
                    data: {
                        subscriptionStatus: 'active',
                        blockType: null,
                        blockReason: null,
                        blockedAt: null,
                    },
                });

                // Log success event
                await tx.subscriptionEvent.create({
                    data: {
                        organizationId: payment.organizationId,
                        eventType: 'payment.succeeded',
                        eventData: {
                            paymentId,
                            amount: paymentDetails.amount,
                            mercadoPagoPaymentId: paymentDetails.mercadoPagoPaymentId,
                            timestamp: new Date().toISOString(),
                        },
                    },
                });
            });

            return {
                success: true,
                paymentId,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Process a failed payment
     */
    async processFailedPayment(
        paymentId: string,
        failureReason: string
    ): Promise<PaymentResult> {
        try {
            const payment = await prisma.subscriptionPayment.findUnique({
                where: { id: paymentId },
            });

            if (!payment) {
                return {
                    success: false,
                    error: 'Payment not found',
                };
            }

            // Update payment status
            await prisma.subscriptionPayment.update({
                where: { id: paymentId },
                data: {
                    status: 'failed',
                    failureReason,
                },
            });

            // Check for multiple failed payments
            const failedCount = await prisma.subscriptionPayment.count({
                where: {
                    organizationId: payment.organizationId,
                    status: 'failed',
                },
            });

            // Apply soft block after 3 failed payments
            if (failedCount >= 3) {
                await prisma.organization.update({
                    where: { id: payment.organizationId },
                    data: {
                        blockType: 'soft_block',
                        blockReason: 'Multiple failed payments',
                        blockedAt: new Date(),
                    },
                });
            }

            // Log failure event
            await prisma.subscriptionEvent.create({
                data: {
                    organizationId: payment.organizationId,
                    eventType: 'payment.failed',
                    eventData: {
                        paymentId,
                        reason: failureReason,
                        failedCount,
                        timestamp: new Date().toISOString(),
                    },
                },
            });

            return {
                success: true,
                paymentId,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Process a refund (with Ley 24.240 compliance)
     */
    async processRefund(
        paymentId: string,
        reason: string,
        options?: {
            forceRefund?: boolean;
            adminId?: string;
        }
    ): Promise<RefundResult> {
        try {
            const payment = await prisma.subscriptionPayment.findUnique({
                where: { id: paymentId },
            });

            if (!payment) {
                return {
                    success: false,
                    error: 'Payment not found',
                };
            }

            if (payment.status !== 'completed') {
                return {
                    success: false,
                    error: 'Payment not completed',
                };
            }

            // Check refund eligibility (Ley 24.240 - 10 days)
            const eligibility = await this.checkRefundEligibility(paymentId);

            if (!eligibility.eligible && !options?.forceRefund) {
                return {
                    success: false,
                    error: 'Payment is outside the refund period (Ley 24.240 - 10 days)',
                };
            }

            // Process refund with MercadoPago
            // FIXME: Implement mercadoPagoClient.createRefund
            // const refundResponse = await mercadoPagoClient.createRefund(
            //     payment.mercadoPagoPaymentId!,
            //     payment.amount
            // );

            // Temporary stub for testing
            const refundResponse = { success: true };

            if (!refundResponse.success) {
                return {
                    success: false,
                    error: 'Refund failed with MercadoPago',
                };
            }

            // Update payment and organization in transaction
            await prisma.$transaction(async (tx) => {
                // Mark payment as refunded
                await tx.subscriptionPayment.update({
                    where: { id: paymentId },
                    data: {
                        status: 'refunded',
                        refundedAt: new Date(),
                        refundReason: reason,
                    },
                });

                // Cancel subscription
                await tx.organization.update({
                    where: { id: payment.organizationId },
                    data: {
                        subscriptionStatus: 'cancelled',
                    },
                });

                // Log refund event
                await tx.subscriptionEvent.create({
                    data: {
                        organizationId: payment.organizationId,
                        eventType: 'payment.refunded',
                        eventData: {
                            paymentId,
                            amount: payment.amount,
                            reason,
                            isLey24240: eligibility.isLey24240,
                            forceRefund: options?.forceRefund || false,
                            adminId: options?.adminId,
                            timestamp: new Date().toISOString(),
                        },
                    },
                });
            });

            return {
                success: true,
                refundAmount: payment.amount,
                isLey24240Refund: eligibility.isLey24240,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Check if payment is eligible for refund (Ley 24.240)
     */
    async checkRefundEligibility(paymentId: string): Promise<RefundEligibility> {
        const payment = await prisma.subscriptionPayment.findUnique({
            where: { id: paymentId },
        });

        if (!payment || !payment.paidAt) {
            return {
                eligible: false,
                daysRemaining: 0,
                isLey24240: false,
                reason: 'Payment not found or not completed',
            };
        }

        const now = new Date();
        const paidAt = new Date(payment.paidAt);
        const daysSincePaid = Math.floor(
            (now.getTime() - paidAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        const daysRemaining = Math.max(0, LEY_24240_REFUND_DAYS - daysSincePaid);
        const eligible = daysSincePaid <= LEY_24240_REFUND_DAYS;

        return {
            eligible,
            daysRemaining,
            isLey24240: eligible,
            reason: eligible
                ? `Within Ley 24.240 refund period (${daysRemaining} days remaining)`
                : 'Outside Ley 24.240 refund period (10 days)',
        };
    }

    /**
     * Create a new payment record
     */
    async createPaymentRecord(data: PaymentData): Promise<{
        id: string;
        organizationId: string;
        subscriptionId: string;
        amount: number;
        currency: string;
        paymentMethod: string;
        status: string;
    }> {
        return await prisma.subscriptionPayment.create({
            data: {
                organizationId: data.organizationId,
                subscriptionId: data.subscriptionId,
                amount: data.amount,
                currency: data.currency,
                paymentMethod: data.paymentMethod,
                status: 'pending',
            },
        });
    }
}

// Export singleton instance
export const paymentProcessor = new PaymentProcessor();
