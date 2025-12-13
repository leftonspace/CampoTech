export async function sendSMS(
  to: string,
  message: string,
  _options?: { orgId?: string }
): Promise<{ success: boolean; messageId?: string }> {
  console.log(`[SMS] Sending to ${to}: ${message}`);
  return { success: true, messageId: `sms-${Date.now()}` };
}
