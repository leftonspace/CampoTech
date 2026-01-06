/**
 * Digital Badge Component
 * =======================
 * 
 * Phase 4.3 Task 4.3.4: Mobile Badge Screen
 * 
 * Displays a QR code badge for technicians to show when entering
 * gated communities (Countries). Shows ART insurance and
 * background check verification status.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Dimensions,
} from 'react-native';
import {
    QrCode,
    Shield,
    FileCheck,
    AlertCircle,
    CheckCircle,
    XCircle,
    Clock,
    RefreshCw,
} from 'lucide-react-native';
import { api } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/auth-context';

// Note: You'll need to install react-native-qrcode-svg:
// pnpm add react-native-qrcode-svg react-native-svg
// For now, we'll show a placeholder

interface BadgeVerification {
    artStatus: 'valid' | 'expiring' | 'expired' | 'missing';
    artExpiry: string | null;
    artProvider: string | null;
    artPolicyNumber: string | null;
    backgroundCheck: 'pending' | 'approved' | 'rejected' | 'expired';
    backgroundCheckDate: string | null;
    backgroundCheckProvider: string | null;
}

interface BadgeData {
    technician: {
        id: string;
        name: string;
        photo: string | null;
        specialty: string | null;
        phone: string;
    };
    organization: {
        id: string;
        name: string;
        logo: string | null;
    };
    verification: BadgeVerification;
    qrPayload: string;
    generatedAt: string;
    validUntil: string | null;
    isValid: boolean;
}

interface DigitalBadgeProps {
    onClose?: () => void;
}

export function DigitalBadge({ onClose }: DigitalBadgeProps) {
    const { user } = useAuth();
    const [badge, setBadge] = useState<BadgeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadBadge = useCallback(async () => {
        if (!user?.id) return;

        try {
            setError(null);
            const response = await api.badge.get(user.id);

            if (response.success && response.data) {
                setBadge(response.data);
            } else {
                setError(response.error?.message || 'Error cargando credencial');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    const handleRefresh = async () => {
        if (!user?.id) return;

        setRefreshing(true);
        try {
            const response = await api.badge.refresh(user.id);

            if (response.success && response.data) {
                setBadge(response.data);
                Alert.alert('Credencial renovada', 'Tu credencial ha sido renovada correctamente');
            } else {
                Alert.alert('Error', response.error?.message || 'No se pudo renovar la credencial');
            }
        } catch (err) {
            Alert.alert('Error', 'Error de conexión al renovar');
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadBadge();
    }, [loadBadge]);

    const getARTStatusDisplay = (status: BadgeVerification['artStatus']) => {
        switch (status) {
            case 'valid':
                return { icon: CheckCircle, text: 'ART Vigente', color: '#059669', bgColor: '#ecfdf5' };
            case 'expiring':
                return { icon: AlertCircle, text: 'ART Por Vencer', color: '#d97706', bgColor: '#fffbeb' };
            case 'expired':
                return { icon: XCircle, text: 'ART Vencida', color: '#dc2626', bgColor: '#fef2f2' };
            case 'missing':
                return { icon: AlertCircle, text: 'Sin ART', color: '#6b7280', bgColor: '#f9fafb' };
        }
    };

    const getBackgroundCheckDisplay = (status: BadgeVerification['backgroundCheck']) => {
        switch (status) {
            case 'approved':
                return { icon: CheckCircle, text: 'Antecedentes Verificados', color: '#059669', bgColor: '#ecfdf5' };
            case 'pending':
                return { icon: Clock, text: 'Verificación Pendiente', color: '#d97706', bgColor: '#fffbeb' };
            case 'rejected':
                return { icon: XCircle, text: 'Verificación Rechazada', color: '#dc2626', bgColor: '#fef2f2' };
            case 'expired':
                return { icon: AlertCircle, text: 'Verificación Expirada', color: '#d97706', bgColor: '#fffbeb' };
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        return new Date(dateStr).toLocaleDateString('es-AR');
    };

    const getDaysUntilExpiry = (dateStr: string | null) => {
        if (!dateStr) return null;
        const expiry = new Date(dateStr);
        const now = new Date();
        const diffMs = expiry.getTime() - now.getTime();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#059669" />
                <Text style={styles.loadingText}>Cargando credencial...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <AlertCircle size={48} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={loadBadge}>
                    <Text style={styles.retryButtonText}>Reintentar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!badge) {
        return null;
    }

    const artStatus = getARTStatusDisplay(badge.verification.artStatus);
    const bgCheckStatus = getBackgroundCheckDisplay(badge.verification.backgroundCheck);
    const ARTIcon = artStatus.icon;
    const BGCheckIcon = bgCheckStatus.icon;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: badge.isValid ? '#059669' : '#d97706' }]}>
                <Shield size={24} color="#fff" />
                <Text style={styles.headerTitle}>
                    {badge.isValid ? 'CREDENCIAL VÁLIDA' : 'CREDENCIAL PARCIAL'}
                </Text>
            </View>

            {/* QR Code */}
            <View style={styles.qrContainer}>
                <View style={styles.qrPlaceholder}>
                    <QrCode size={120} color="#111827" />
                    <Text style={styles.qrHint}>QR Code</Text>
                </View>
                <Text style={styles.qrInstruction}>
                    Mostrá este código al ingresar a countries o barrios cerrados
                </Text>
            </View>

            {/* Technician Info */}
            <View style={styles.infoSection}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {badge.technician.name[0].toUpperCase()}
                    </Text>
                </View>
                <Text style={styles.techName}>{badge.technician.name}</Text>
                {badge.technician.specialty && (
                    <Text style={styles.techSpecialty}>{badge.technician.specialty}</Text>
                )}
                <Text style={styles.orgName}>{badge.organization.name}</Text>
            </View>

            {/* Verification Status */}
            <View style={styles.verificationSection}>
                {/* ART Status */}
                <View style={[styles.statusCard, { backgroundColor: artStatus.bgColor }]}>
                    <ARTIcon size={24} color={artStatus.color} />
                    <View style={styles.statusInfo}>
                        <Text style={[styles.statusText, { color: artStatus.color }]}>
                            {artStatus.text}
                        </Text>
                        {badge.verification.artProvider && (
                            <Text style={styles.statusDetail}>
                                {badge.verification.artProvider}
                                {badge.verification.artExpiry && (
                                    <>
                                        {' '}• Vence {formatDate(badge.verification.artExpiry)}
                                        {badge.verification.artStatus === 'expiring' && (
                                            <Text style={{ color: '#d97706' }}>
                                                {' '}({getDaysUntilExpiry(badge.verification.artExpiry)} días)
                                            </Text>
                                        )}
                                    </>
                                )}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Background Check Status */}
                <View style={[styles.statusCard, { backgroundColor: bgCheckStatus.bgColor }]}>
                    <BGCheckIcon size={24} color={bgCheckStatus.color} />
                    <View style={styles.statusInfo}>
                        <Text style={[styles.statusText, { color: bgCheckStatus.color }]}>
                            {bgCheckStatus.text}
                        </Text>
                        {badge.verification.backgroundCheckDate && (
                            <Text style={styles.statusDetail}>
                                Verificado el {formatDate(badge.verification.backgroundCheckDate)}
                                {badge.verification.backgroundCheckProvider && (
                                    <> por {badge.verification.backgroundCheckProvider}</>
                                )}
                            </Text>
                        )}
                    </View>
                </View>
            </View>

            {/* Validity */}
            {badge.validUntil && (
                <View style={styles.validitySection}>
                    <Clock size={16} color="#6b7280" />
                    <Text style={styles.validityText}>
                        Válida hasta: {formatDate(badge.validUntil)}
                    </Text>
                </View>
            )}

            {/* Refresh Button */}
            <TouchableOpacity
                style={styles.refreshButton}
                onPress={handleRefresh}
                disabled={refreshing}
            >
                <RefreshCw
                    size={18}
                    color="#fff"
                    style={refreshing ? styles.rotating : undefined}
                />
                <Text style={styles.refreshButtonText}>
                    {refreshing ? 'Renovando...' : 'Renovar credencial'}
                </Text>
            </TouchableOpacity>

            {/* Footer */}
            <Text style={styles.footer}>
                Credencial emitida por CampoTech
            </Text>
        </View>
    );
}

const { width } = Dimensions.get('window');
const qrSize = Math.min(width * 0.5, 200);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: '#6b7280',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        gap: 16,
    },
    errorText: {
        fontSize: 16,
        color: '#dc2626',
        textAlign: 'center',
    },
    retryButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: '#059669',
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    qrContainer: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    qrPlaceholder: {
        width: qrSize,
        height: qrSize,
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrHint: {
        marginTop: 8,
        fontSize: 12,
        color: '#9ca3af',
    },
    qrInstruction: {
        marginTop: 16,
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        paddingHorizontal: 24,
    },
    infoSection: {
        alignItems: 'center',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        marginHorizontal: 16,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#059669',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 24,
        fontWeight: '600',
        color: '#fff',
    },
    techName: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    techSpecialty: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 4,
    },
    orgName: {
        fontSize: 14,
        color: '#9ca3af',
        marginTop: 4,
    },
    verificationSection: {
        padding: 16,
        gap: 12,
    },
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 12,
    },
    statusInfo: {
        flex: 1,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
    },
    statusDetail: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 2,
    },
    validitySection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        marginHorizontal: 16,
        backgroundColor: '#f9fafb',
        borderRadius: 8,
    },
    validityText: {
        fontSize: 14,
        color: '#6b7280',
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#059669',
        marginHorizontal: 16,
        marginTop: 16,
        paddingVertical: 14,
        borderRadius: 12,
    },
    refreshButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    rotating: {
        // Animation would be handled with Animated API in production
    },
    footer: {
        textAlign: 'center',
        fontSize: 12,
        color: '#9ca3af',
        marginTop: 16,
        marginBottom: 24,
    },
});

export default DigitalBadge;
