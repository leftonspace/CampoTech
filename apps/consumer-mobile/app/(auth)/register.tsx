/**
 * Register Screen - Consumer App
 * ===============================
 *
 * With Phone + OTP auth, registration and login are the same flow.
 * This screen redirects to login.
 */

import { useEffect } from 'react';
import { router } from 'expo-router';

export default function RegisterScreen() {
  useEffect(() => {
    // Phone + OTP handles both login and registration
    // Redirect to login screen
    router.replace('/(auth)/login');
  }, []);

  return null;
}
