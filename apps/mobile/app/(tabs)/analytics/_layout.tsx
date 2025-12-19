/**
 * Analytics Layout
 * ================
 *
 * Stack navigation for analytics screens
 */

import { Stack } from 'expo-router';

export default function AnalyticsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
