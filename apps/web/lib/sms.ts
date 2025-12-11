import twilio from 'twilio';

// SMS Provider Interface
export interface SMSProvider {
  sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// Twilio SMS Provider Implementation
export class TwilioSMSProvider implements SMSProvider {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !phoneNumber) {
      throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.');
    }

    this.client = twilio(accountSid, authToken);
    this.fromNumber = phoneNumber;
  }

  async sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to,
      });

      console.log(`SMS sent successfully to ${to}, SID: ${result.sid}`);

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error: unknown) {
      // Extract detailed Twilio error info
      let errorMessage = 'Unknown error sending SMS';
      let errorCode = '';

      if (error && typeof error === 'object') {
        const twilioError = error as { message?: string; code?: number; moreInfo?: string };
        errorMessage = twilioError.message || errorMessage;
        errorCode = twilioError.code ? ` (Code: ${twilioError.code})` : '';
        if (twilioError.moreInfo) {
          console.error(`Twilio error details: ${twilioError.moreInfo}`);
        }
      }

      console.error(`Failed to send SMS to ${to}:`, errorMessage, errorCode);

      return {
        success: false,
        error: `${errorMessage}${errorCode}`,
      };
    }
  }
}

// Console SMS Provider for development/testing
export class ConsoleSMSProvider implements SMSProvider {
  async sendSMS(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log('========================================');
    console.log('📱 SMS (DEV MODE - NOT ACTUALLY SENT)');
    console.log(`To: ${to}`);
    console.log(`Message: ${message}`);
    console.log('========================================');

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
    };
  }
}

// Factory function to get the appropriate SMS provider
export function getSMSProvider(): SMSProvider {
  // In development without Twilio credentials, use console provider
  if (process.env.NODE_ENV === 'development' && !process.env.TWILIO_ACCOUNT_SID) {
    console.log('Using ConsoleSMSProvider (dev mode - SMS will be logged to console)');
    return new ConsoleSMSProvider();
  }

  // Check if Twilio is configured
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    console.log('Using TwilioSMSProvider');
    return new TwilioSMSProvider();
  }

  // Fallback to console provider if Twilio not configured
  console.warn('Twilio not configured. Using ConsoleSMSProvider. SMS will only be logged to console.');
  return new ConsoleSMSProvider();
}

// Singleton instance
let smsProviderInstance: SMSProvider | null = null;

export function getOrCreateSMSProvider(): SMSProvider {
  if (!smsProviderInstance) {
    smsProviderInstance = getSMSProvider();
  }
  return smsProviderInstance;
}
