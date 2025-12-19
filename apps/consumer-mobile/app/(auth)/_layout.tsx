/**
 * Auth Layout - Consumer App
 * ==========================
 *
 * Layout for authentication screens (login, register).
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
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
        name="login"
        options={{
          headerTitle: 'Iniciar sesión',
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          headerTitle: 'Crear cuenta',
        }}
      />
    </Stack>
  );
}
