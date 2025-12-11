/**
 * WhatsApp Business API Provider
 * Uses Meta's WhatsApp Cloud API
 *
 * Required environment variables:
 * - WHATSAPP_PHONE_NUMBER_ID: Your WhatsApp Business phone number ID
 * - WHATSAPP_ACCESS_TOKEN: Your Meta access token
 * - WHATSAPP_BUSINESS_ACCOUNT_ID: Your WhatsApp Business Account ID (optional)
 */

export interface WhatsAppProvider {
  sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
  sendTemplate(to: string, templateName: string, languageCode: string, components?: TemplateComponent[]): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: { type: string; text?: string; image?: { link: string } }[];
}

interface WhatsAppAPIResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

interface WhatsAppAPIError {
  error: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id: string;
  };
}

// Meta WhatsApp Cloud API Provider
export class MetaWhatsAppProvider implements WhatsAppProvider {
  private phoneNumberId: string;
  private accessToken: string;
  private apiVersion = 'v18.0';
  private baseUrl = 'https://graph.facebook.com';

  constructor() {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      throw new Error(
        'WhatsApp credentials not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN environment variables.'
      );
    }

    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
  }

  /**
   * Format phone number for WhatsApp API
   * WhatsApp expects numbers without + or spaces, just digits
   * Special handling for Argentine numbers which have different formats
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '');

    // Special handling for Argentine mobile numbers
    // International format: 54 9 XX XXXX XXXX (with 9 prefix)
    // Local format: 54 XX 15 XXXX XXXX (with 15 prefix)
    // Meta's sandbox stores numbers in local format with "15" prefix
    if (digits.startsWith('549') && digits.length === 13) {
      // Convert from international (9) to local (15) format
      // 5491162107127 -> 541115 + 62107127
      const areaCode = digits.substring(3, 5); // e.g., "11"
      const localNumber = digits.substring(5); // e.g., "62107127"
      const converted = `54${areaCode}15${localNumber}`;
      console.log(`[WhatsApp] Converting Argentine number: ${digits} -> ${converted}`);
      digits = converted;
    }

    console.log(`[WhatsApp] Final phone number for API: ${digits}`);
    return digits;
  }

  /**
   * Send a text message via WhatsApp
   */
  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);
      console.log(`[WhatsApp] Sending message to formatted phone: ${formattedPhone}`);

      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: formattedPhone,
            type: 'text',
            text: {
              preview_url: false,
              body: message,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as WhatsAppAPIError;
        console.error('WhatsApp API error:', errorData.error);
        return {
          success: false,
          error: `${errorData.error.message} (Code: ${errorData.error.code})`,
        };
      }

      const successData = data as WhatsAppAPIResponse;
      console.log(`WhatsApp message sent to ${formattedPhone}, ID: ${successData.messages[0].id}`);

      return {
        success: true,
        messageId: successData.messages[0].id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to send WhatsApp message to ${to}:`, errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send a template message via WhatsApp
   * Templates must be pre-approved by Meta
   *
   * For OTP, you might use Meta's authentication template
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string = 'es_AR',
    components?: TemplateComponent[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const formattedPhone = this.formatPhoneNumber(to);

      const body: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
        },
      };

      // Add components if provided (for dynamic content in templates)
      if (components && components.length > 0) {
        (body.template as Record<string, unknown>).components = components;
      }

      const response = await fetch(
        `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as WhatsAppAPIError;
        console.error('WhatsApp template API error:', errorData.error);
        return {
          success: false,
          error: `${errorData.error.message} (Code: ${errorData.error.code})`,
        };
      }

      const successData = data as WhatsAppAPIResponse;
      console.log(`WhatsApp template "${templateName}" sent to ${to}, ID: ${successData.messages[0].id}`);

      return {
        success: true,
        messageId: successData.messages[0].id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to send WhatsApp template to ${to}:`, errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send OTP via WhatsApp using Meta's authentication template
   * Note: This requires an approved authentication template
   */
  async sendOTP(to: string, otp: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // For sandbox/testing, we can send a regular text message
    // For production, you should use an approved template

    const message = `Tu código de verificación de CampoTech es: ${otp}\n\nEste código expira en 5 minutos. No compartas este código con nadie.`;

    return this.sendMessage(to, message);
  }
}

// Console WhatsApp Provider for development/testing
export class ConsoleWhatsAppProvider implements WhatsAppProvider {
  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log('========================================');
    console.log('📱 WhatsApp (DEV MODE - NOT ACTUALLY SENT)');
    console.log(`To: ${to}`);
    console.log(`Message: ${message}`);
    console.log('========================================');

    return {
      success: true,
      messageId: `whatsapp-dev-${Date.now()}`,
    };
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components?: TemplateComponent[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    console.log('========================================');
    console.log('📱 WhatsApp Template (DEV MODE - NOT ACTUALLY SENT)');
    console.log(`To: ${to}`);
    console.log(`Template: ${templateName}`);
    console.log(`Language: ${languageCode}`);
    console.log(`Components: ${JSON.stringify(components)}`);
    console.log('========================================');

    return {
      success: true,
      messageId: `whatsapp-template-dev-${Date.now()}`,
    };
  }
}

// Factory function to get the appropriate WhatsApp provider
export function getWhatsAppProvider(): WhatsAppProvider {
  // In development without WhatsApp credentials, use console provider
  if (process.env.NODE_ENV === 'development' && !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.log('Using ConsoleWhatsAppProvider (dev mode - messages will be logged to console)');
    return new ConsoleWhatsAppProvider();
  }

  // Check if WhatsApp is configured
  if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN) {
    console.log('Using MetaWhatsAppProvider');
    return new MetaWhatsAppProvider();
  }

  // Fallback to console provider if WhatsApp not configured
  console.warn('WhatsApp not configured. Using ConsoleWhatsAppProvider. Messages will only be logged to console.');
  return new ConsoleWhatsAppProvider();
}

// Singleton instance
let whatsappProviderInstance: WhatsAppProvider | null = null;

export function getOrCreateWhatsAppProvider(): WhatsAppProvider {
  if (!whatsappProviderInstance) {
    whatsappProviderInstance = getWhatsAppProvider();
  }
  return whatsappProviderInstance;
}
