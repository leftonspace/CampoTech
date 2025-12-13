// SMS Provider factory
export interface SMSProvider {
  send(to: string, message: string): Promise<{ success: boolean; messageId?: string }>;
}

export async function getOrCreateSMSProvider(): Promise<SMSProvider> {
  return {
    async send(to: string, message: string) {
      console.log(`[SMS] Would send to ${to}: ${message}`);
      return { success: true, messageId: `mock-${Date.now()}` };
    }
  };
}
