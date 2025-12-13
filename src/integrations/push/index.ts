export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  _data?: Record<string, string>
): Promise<{ success: boolean; messageId?: string }> {
  console.log(`[PUSH] Sending to ${userId}: ${title}`);
  return { success: true, messageId: `push-${Date.now()}` };
}
