/**
 * Route Button Component
 * =======================
 *
 * Phase 2.3 Task 2.3.5: Mobile App Route Integration
 *
 * Button that opens Google Maps with optimized route for
 * the technician's daily jobs.
 */

import { TouchableOpacity, View, Text, StyleSheet, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface RouteButtonProps {
    url: string;
    jobCount: number;
    segmentNumber?: number;
    totalSegments?: number;
    distanceMeters?: number;
    durationSeconds?: number;
    compact?: boolean;
}

/**
 * Format duration from seconds to human readable
 */
function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format distance from meters to km
 */
function formatDistance(meters: number): string {
    if (meters < 1000) return `${meters}m`;
    const km = (meters / 1000).toFixed(1);
    return `${km} km`;
}

export default function RouteButton({
    url,
    jobCount,
    segmentNumber,
    totalSegments,
    distanceMeters,
    durationSeconds,
    compact = false,
}: RouteButtonProps) {
    const handlePress = async () => {
        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Error', 'No se puede abrir Google Maps');
            }
        } catch (error) {
            console.error('Error opening maps:', error);
            Alert.alert('Error', 'No se puede abrir Google Maps');
        }
    };

    const hasMultipleSegments = totalSegments && totalSegments > 1;

    if (compact) {
        return (
            <TouchableOpacity style={styles.compactButton} onPress={handlePress}>
                <View style={styles.iconCircle}>
                    <Feather name="navigation" size={18} color="#fff" />
                </View>
                <Text style={styles.compactButtonText}>Navegar</Text>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity style={styles.button} onPress={handlePress}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Feather name="navigation" size={24} color="#fff" />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.mainText}>
                        Navegar todos ({jobCount} trabajos)
                    </Text>
                    {hasMultipleSegments && (
                        <Text style={styles.segmentText}>
                            Ruta {segmentNumber} de {totalSegments}
                        </Text>
                    )}
                    {(distanceMeters || durationSeconds) && (
                        <Text style={styles.detailText}>
                            {distanceMeters && formatDistance(distanceMeters)}
                            {distanceMeters && durationSeconds && ' • '}
                            {durationSeconds && formatDuration(durationSeconds)}
                        </Text>
                    )}
                </View>
                <Feather name="chevron-right" size={24} color="#fff" style={styles.chevron} />
            </View>
        </TouchableOpacity>
    );
}

/**
 * New Route Banner - shown after 10th job completion
 */
export function NewRouteBanner({
    remainingJobs,
    onPress,
}: {
    remainingJobs: number;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity style={styles.banner} onPress={onPress}>
            <View style={styles.bannerIcon}>
                <Text style={styles.bannerEmoji}>🎉</Text>
            </View>
            <View style={styles.bannerContent}>
                <Text style={styles.bannerTitle}>¡Nueva ruta generada!</Text>
                <Text style={styles.bannerText}>
                    {remainingJobs} trabajos restantes. Toca para ver la nueva ruta.
                </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#16a34a" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: '#3b82f6',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    mainText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    segmentText: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.8)',
        marginTop: 2,
    },
    detailText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        marginTop: 4,
    },
    chevron: {
        opacity: 0.8,
    },
    // Compact style
    compactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3b82f6',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 6,
    },
    iconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    // Banner styles
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdf4',
        borderWidth: 1,
        borderColor: '#bbf7d0',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    bannerIcon: {
        marginRight: 12,
    },
    bannerEmoji: {
        fontSize: 24,
    },
    bannerContent: {
        flex: 1,
    },
    bannerTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#166534',
    },
    bannerText: {
        fontSize: 13,
        color: '#16a34a',
        marginTop: 2,
    },
});
