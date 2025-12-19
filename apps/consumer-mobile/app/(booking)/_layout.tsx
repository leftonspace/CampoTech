/**
 * Booking Layout - Consumer App
 * =============================
 *
 * Layout for booking-related screens (quote requests).
 */

import { Stack } from 'expo-router';

export default function BookingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerTintColor: '#111827',
        presentation: 'modal',
      }}
    >
      <Stack.Screen
        name="request/[providerId]"
        options={{
          headerTitle: 'Solicitar presupuesto',
        }}
      />
    </Stack>
  );
}
