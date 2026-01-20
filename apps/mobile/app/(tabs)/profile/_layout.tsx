/**
 * Profile Layout
 * ==============
 * 
 * Stack navigator for profile-related screens
 */

import { Stack } from 'expo-router';

export default function ProfileLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="badge" />
        </Stack>
    );
}
