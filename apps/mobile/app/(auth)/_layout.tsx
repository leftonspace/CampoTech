/**
 * Auth Layout
 * ===========
 *
 * Handles authentication screens including login and invite acceptance.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen
        name="invite/[token]"
        options={{
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
