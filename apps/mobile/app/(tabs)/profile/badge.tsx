/**
 * Digital Badge Screen
 * ====================
 * 
 * Phase 4.3 Task 4.3.4: Mobile Badge Screen
 * 
 * Full-screen badge display for technicians to show at
 * gated community security checkpoints.
 */

import React from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { DigitalBadge } from '../../../components/badge/DigitalBadge';

export default function BadgeScreen() {
    const handleBack = () => {
        router.back();
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <ArrowLeft size={24} color="#111827" />
                </TouchableOpacity>
            </View>

            {/* Badge */}
            <DigitalBadge />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
});
