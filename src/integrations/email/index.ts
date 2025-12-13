export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  _options?: { from?: string; orgId?: string }
): Promise<{ success: boolean; messageId?: string }> {
  console.log(`[EMAIL] Sending to ${to}: ${subject}`);
  return { success: true, messageId: `email-${Date.now()}` };
}
