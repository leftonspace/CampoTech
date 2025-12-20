/**
 * Root Layout - Consumer App
 * ==========================
 *
 * Phase 3.1.2: App Structure
 * Main navigation structure for consumer marketplace app.
 * Includes Sentry error tracking.
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

import { initSentry, withSentry } from '../lib/monitoring/sentry';

// Initialize Sentry as early as possible
initSentry();

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Add custom fonts here if needed
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          {/* Main tabs */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* Auth screens */}
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />

          {/* Category listing */}
          <Stack.Screen
            name="category/[slug]"
            options={{
              headerShown: true,
              headerTitle: '',
              headerBackTitle: 'Volver',
              headerTintColor: '#059669',
            }}
          />

          {/* Provider profile */}
          <Stack.Screen
            name="provider/[id]"
            options={{
              headerShown: true,
              headerTitle: '',
              headerBackTitle: 'Volver',
              headerTintColor: '#059669',
              headerTransparent: true,
            }}
          />

          {/* Rating page */}
          <Stack.Screen
            name="rate/[token]"
            options={{
              headerShown: true,
              headerTitle: 'Calificar servicio',
              headerBackTitle: 'Volver',
              headerTintColor: '#059669',
            }}
          />

          {/* Booking/Quote request */}
          <Stack.Screen
            name="(booking)"
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

// Wrap with Sentry error boundary
export default withSentry(RootLayout);
