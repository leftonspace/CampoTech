/**
 * App Entry Point
 * ===============
 *
 * Redirects to the appropriate screen based on auth state.
 * The AuthProvider handles the actual navigation logic.
 */

import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to login - AuthProvider will redirect to (tabs) if authenticated
  return <Redirect href="/(auth)/login" />;
}
