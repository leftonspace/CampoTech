/**
 * Badge Prompt Hook
 * =================
 * 
 * Phase 4.4: Security & Trust System
 * 
 * This hook manages:
 * 1. Confirmation Codes (MANDATORY) - Sent to customers when technician navigates
 * 2. Digital Badge Reminder (OPTIONAL) - Daily push notification to build habit
 * 
 * Design Philosophy:
 * - Confirmation code is ALWAYS sent (no opt-out) for security
 * - Badge reminder is sent ONCE per day via push notification
 * - Goal: Build unconscious habit of showing badge for trust & professionalism
 */

import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api/client';
import { scheduleLocalNotification } from '../lib/notifications/push-notifications';

const DAILY_BADGE_REMINDER_KEY = 'badge_reminder_scheduled_date';
const BADGE_REMINDER_NOTIFICATION_ID_KEY = 'badge_reminder_notification_id';

interface Customer {
    id: string;
    name: string;
    customerType?: string;
    address?: {
        fullAddress?: string;
    };
}

interface Job {
    id: string;
    customer?: Customer;
    customerId?: string;
}

/**
 * Check if we should schedule today's badge reminder notification
 * Returns true if reminder hasn't been scheduled today
 */
async function shouldScheduleDailyBadgeReminder(): Promise<boolean> {
    try {
        const lastScheduled = await AsyncStorage.getItem(DAILY_BADGE_REMINDER_KEY);
        const today = new Date().toDateString();

        if (lastScheduled === today) {
            return false; // Already scheduled today
        }

        return true;
    } catch {
        return true; // Schedule if error reading
    }
}

/**
 * Mark that the daily badge reminder was scheduled
 */
async function markBadgeReminderScheduled(): Promise<void> {
    try {
        const today = new Date().toDateString();
        await AsyncStorage.setItem(DAILY_BADGE_REMINDER_KEY, today);
    } catch (error) {
        console.error('Error saving badge reminder date:', error);
    }
}

/**
 * Schedule the daily badge reminder as a push notification
 * This shows immediately as a notification that the user can tap to open badge
 */
async function sendDailyBadgeNotification(): Promise<void> {
    try {
        const notificationId = await scheduleLocalNotification(
            '🛡️ Tu Credencial Digital',
            'Recordá que podés mostrar tu credencial digital a los clientes para generar más confianza.',
            {
                type: 'badge_reminder', // Tapping navigates to badge screen
                title: 'Tu Credencial Digital',
                body: 'Recordá mostrar tu credencial a los clientes',
                priority: 'normal',
            },
            null // null trigger = show immediately
        );

        // Store notification ID in case we need to cancel it later
        await AsyncStorage.setItem(BADGE_REMINDER_NOTIFICATION_ID_KEY, notificationId);
    } catch (error) {
        console.error('Error scheduling badge reminder notification:', error);
    }
}

/**
 * Hook to manage confirmation codes and optional badge reminders
 */
export function useBadgePrompt() {
    /**
     * Send confirmation code to customer (MANDATORY)
     * Should be called when technician starts navigation
     */
    const sendConfirmationCode = async (jobId: string): Promise<boolean> => {
        try {
            const response = await api.jobs.confirmationCode.send(jobId);
            return response.success ?? false;
        } catch (error) {
            console.error('Error sending confirmation code:', error);
            return false;
        }
    };

    /**
     * Call this when technician starts their first job of the day
     * Sends a push notification badge reminder (once per day only)
     */
    const checkDailyBadgeReminder = async () => {
        const shouldSchedule = await shouldScheduleDailyBadgeReminder();
        if (shouldSchedule) {
            await markBadgeReminderScheduled();
            await sendDailyBadgeNotification();
        }
    };

    /**
     * Call this when starting navigation to a job
     * 1. Sends confirmation code to customer (MANDATORY)
     * 2. Sends daily badge reminder notification if not sent today (OPTIONAL)
     */
    const onStartNavigation = async (job: Job) => {
        // MANDATORY: Always send confirmation code
        await sendConfirmationCode(job.id);

        // OPTIONAL: Send daily badge reminder notification (once per day)
        await checkDailyBadgeReminder();
    };

    /**
     * Navigate to badge screen
     */
    const showBadge = () => {
        router.push('/(tabs)/profile/badge');
    };

    return {
        onStartNavigation,
        showBadge,
        sendConfirmationCode,
        checkDailyBadgeReminder,
    };
}

export default useBadgePrompt;
