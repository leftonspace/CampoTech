/**
 * Support Notification Service
 * ============================
 * 
 * Phase 4: Task 4.5
 * 
 * Multi-channel notification service for support queue responses.
 * Supports:
 * - Browser push notifications
 * - Email via Resend
 * - WhatsApp via existing infrastructure
 */

import { getEmailProvider } from '@/lib/email';

// =============================================================================
// TYPES
// =============================================================================

export type NotificationChannel = 'push' | 'email' | 'whatsapp';

export interface SupportNotificationRecipient {
    email?: string;
    phone?: string;
    pushSubscription?: string;  // Web Push subscription JSON
}

export interface SendSupportNotificationOptions {
    ticketNumber: string;
    ticketId: string;
    message: string;
    channels: NotificationChannel[];
    recipient: SupportNotificationRecipient;
    adminName?: string;
    organizationName?: string;
}

export interface NotificationResults {
    push: { sent: boolean; error?: string };
    email: { sent: boolean; error?: string };
    whatsapp: { sent: boolean; error?: string };
}

// =============================================================================
// NOTIFICATION FUNCTIONS
// =============================================================================

/**
 * Send browser push notification
 */
async function sendPushNotification(
    subscription: string,
    ticketNumber: string,
    _message: string
): Promise<{ sent: boolean; error?: string }> {
    try {
        // Note: Web Push requires VAPID keys and the web-push library
        // For now, we'll mark this as not implemented and log the attempt
        console.log(`[Support Notification] Push notification queued for ticket ${ticketNumber}`);
        console.log(`[Support Notification] Subscription: ${subscription.substring(0, 50)}...`);

        // TODO: Implement actual web-push when VAPID keys are configured
        // const webpush = await import('web-push');
        // await webpush.sendNotification(JSON.parse(subscription), JSON.stringify({
        //   title: `Respuesta a ticket #${ticketNumber}`,
        //   body: message.substring(0, 100),
        //   icon: '/icons/support-icon.png',
        //   data: { ticketNumber }
        // }));

        return { sent: false, error: 'Push notifications not yet configured (VAPID keys required)' };
    } catch (error) {
        console.error('[Support Notification] Push error:', error);
        return { sent: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Send email notification via Resend
 */
async function sendEmailNotification(
    email: string,
    ticketNumber: string,
    ticketId: string,
    message: string,
    adminName?: string
): Promise<{ sent: boolean; error?: string }> {
    try {
        const provider = getEmailProvider();

        // Generate chat link for visitor to return
        const chatLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com.ar'}?chat=open&ticket=${ticketNumber}`;

        const result = await provider.sendEmail({
            to: email,
            subject: `Respuesta a tu consulta #${ticketNumber} - CampoTech`,
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981, #0d9488); padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 20px;">🎉 Respuesta a tu consulta</h1>
      <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Ticket #${ticketNumber}</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 24px;">
      <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
        ${adminName ? `<strong>${adminName}</strong> respondió a tu consulta:` : 'Recibiste una respuesta a tu consulta:'}
      </p>
      
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="color: #166534; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${message}</p>
      </div>
      
      <div style="text-align: center; margin-top: 24px;">
        <a href="${chatLink}" style="display: inline-block; background: #10b981; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Ver conversación completa
        </a>
      </div>
      
      <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
        Podés responder directamente desde nuestro chat en la web
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="color: #9ca3af; font-size: 12px; margin: 0;">
        CampoTech - Gestión inteligente para técnicos de campo
      </p>
    </div>
  </div>
</body>
</html>
      `,
        });

        if (result.success && result.messageId) {
            console.log(`[Support Notification] Email sent to ${email} for ticket ${ticketNumber}`);
            return { sent: true };
        } else {
            return { sent: false, error: result.error || 'Email provider returned no ID' };
        }
    } catch (error) {
        console.error('[Support Notification] Email error:', error);
        return { sent: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

/**
 * Send WhatsApp notification
 */
async function sendWhatsAppNotification(
    phone: string,
    ticketNumber: string,
    message: string,
    _adminName?: string
): Promise<{ sent: boolean; error?: string }> {
    try {
        // Format phone to E.164 if needed
        let formattedPhone = phone.replace(/\D/g, '');
        if (!formattedPhone.startsWith('54') && formattedPhone.length === 10) {
            formattedPhone = `54${formattedPhone}`;
        }

        // For now, use wa.me link as fallback (actual API integration TBD)
        const chatLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com.ar'}?chat=open&ticket=${ticketNumber}`;
        const _whatsappMessage = `🎉 *Respuesta a tu ticket #${ticketNumber}*\n\n${message.substring(0, 500)}\n\n🔗 Ver conversación completa: ${chatLink}`;

        console.log(`[Support Notification] WhatsApp notification for ${formattedPhone}, ticket ${ticketNumber}`);

        // TODO: Integrate with existing WhatsApp send infrastructure
        // This would use the organization's WhatsApp credits system
        // await sendWhatsAppMessage({ to: formattedPhone, message: whatsappMessage });

        return { sent: false, error: 'WhatsApp API integration pending - organization credits required' };
    } catch (error) {
        console.error('[Support Notification] WhatsApp error:', error);
        return { sent: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Send support notification via multiple channels
 */
export async function sendSupportNotification(
    options: SendSupportNotificationOptions
): Promise<NotificationResults> {
    const { ticketNumber, ticketId, message, channels, recipient, adminName } = options;

    const results: NotificationResults = {
        push: { sent: false },
        email: { sent: false },
        whatsapp: { sent: false },
    };

    // Send via each requested channel
    const promises: Promise<void>[] = [];

    if (channels.includes('push') && recipient.pushSubscription) {
        promises.push(
            sendPushNotification(recipient.pushSubscription, ticketNumber, message)
                .then(result => { results.push = result; })
        );
    }

    if (channels.includes('email') && recipient.email) {
        promises.push(
            sendEmailNotification(recipient.email, ticketNumber, ticketId, message, adminName)
                .then(result => { results.email = result; })
        );
    }

    if (channels.includes('whatsapp') && recipient.phone) {
        promises.push(
            sendWhatsAppNotification(recipient.phone, ticketNumber, message, adminName)
                .then(result => { results.whatsapp = result; })
        );
    }

    // Wait for all notifications to complete
    await Promise.all(promises);

    // Log summary
    const sentChannels = Object.entries(results)
        .filter(([_, v]) => v.sent)
        .map(([k]) => k);

    console.log(`[Support Notification] Ticket #${ticketNumber}: Sent via ${sentChannels.length > 0 ? sentChannels.join(', ') : 'none'}`);

    return results;
}

/**
 * Generate a unique ticket number
 */
export function generateTicketNumber(): string {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${year}${month}${random}`;
}
