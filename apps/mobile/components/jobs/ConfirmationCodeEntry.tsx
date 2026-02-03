/**
 * Confirmation Code Entry Component
 * ==================================
 * 
 * Phase 4.4: Customer Verification System
 * 
 * Displays a 4-digit code entry screen for technicians to enter
 * the confirmation code they receive from the customer.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Keyboard,
} from 'react-native';
import {
    Shield,
    CheckCircle,
    XCircle,
    RefreshCw,
} from 'lucide-react-native';
import { api } from '../../lib/api/client';

interface ConfirmationCodeEntryProps {
    jobId: string;
    customerName: string;
    onVerified: () => void;
    onCodeSent?: () => void;
}

export function ConfirmationCodeEntry({
    jobId,
    customerName,
    onVerified,
    onCodeSent,
}: ConfirmationCodeEntryProps) {
    const [code, setCode] = useState(['', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<{
        codeRequired: boolean;
        codeSent: boolean;
        codeVerified: boolean;
        attemptsRemaining: number;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const inputRefs = useRef<(TextInput | null)[]>([null, null, null, null]);

    // Load initial status
    useEffect(() => {
        loadStatus();
    }, [jobId]);

    const loadStatus = async () => {
        try {
            const response = await api.jobs.confirmationCode.status(jobId);
            if (response.success && response.data) {
                setStatus(response.data);

                // If already verified, notify parent
                if (response.data.codeVerified) {
                    setSuccess(true);
                    onVerified();
                }

                // If code not sent yet and required, send it
                if (response.data.codeRequired && !response.data.codeSent) {
                    await sendCode();
                }
            }
        } catch (err) {
            console.error('Error loading code status:', err);
        }
    };

    const sendCode = async () => {
        setSending(true);
        setError(null);

        try {
            const response = await api.jobs.confirmationCode.send(jobId);
            if (response.success) {
                setStatus(prev => prev ? { ...prev, codeSent: true } : null);
                onCodeSent?.();
            } else {
                setError(response.error?.message || 'Error al enviar el código');
            }
        } catch (err) {
            setError('Error al enviar el código');
        } finally {
            setSending(false);
        }
    };

    const handleCodeChange = (index: number, value: string) => {
        // Only allow digits
        const digit = value.replace(/[^0-9]/g, '');

        if (digit.length <= 1) {
            const newCode = [...code];
            newCode[index] = digit;
            setCode(newCode);
            setError(null);

            // Auto-focus next input
            if (digit && index < 3) {
                inputRefs.current[index + 1]?.focus();
            }

            // Auto-verify when complete
            if (digit && index === 3) {
                const fullCode = [...newCode.slice(0, 3), digit].join('');
                if (fullCode.length === 4) {
                    Keyboard.dismiss();
                    verifyCode(fullCode);
                }
            }
        }
    };

    const handleKeyPress = (index: number, key: string) => {
        if (key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const verifyCode = async (codeToVerify?: string) => {
        const fullCode = codeToVerify || code.join('');

        if (fullCode.length !== 4) {
            setError('Ingresá el código de 4 dígitos');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await api.jobs.confirmationCode.verify(jobId, fullCode);

            if (response.success && response.data?.verified) {
                setSuccess(true);
                onVerified();
            } else {
                const attemptsRemaining = (response as { attemptsRemaining?: number }).attemptsRemaining;
                if (attemptsRemaining !== undefined && attemptsRemaining <= 0) {
                    setError('Máximo de intentos alcanzado. Contactá al cliente directamente.');
                } else {
                    setError(`Código incorrecto. ${attemptsRemaining || 0} intentos restantes.`);
                }
                // Clear the inputs
                setCode(['', '', '', '']);
                inputRefs.current[0]?.focus();
            }
        } catch (err) {
            setError('Error al verificar el código');
        } finally {
            setLoading(false);
        }
    };

    // Success state
    if (success) {
        return (
            <View style={styles.container}>
                <View style={styles.successContainer}>
                    <CheckCircle size={64} color="#059669" />
                    <Text style={styles.successTitle}>¡Verificado!</Text>
                    <Text style={styles.successText}>
                        El cliente confirmó tu llegada
                    </Text>
                </View>
            </View>
        );
    }

    // Loading status
    if (!status) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#059669" />
            </View>
        );
    }

    // Code not required
    if (!status.codeRequired) {
        return null;
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Shield size={32} color="#059669" />
                <Text style={styles.title}>Código de Confirmación</Text>
            </View>

            {/* Instructions */}
            <Text style={styles.instruction}>
                Pedí el código a <Text style={styles.customerName}>{customerName}</Text> para confirmar tu llegada
            </Text>

            {/* Code sending status */}
            {sending ? (
                <View style={styles.sendingContainer}>
                    <ActivityIndicator size="small" color="#059669" />
                    <Text style={styles.sendingText}>Enviando código al cliente...</Text>
                </View>
            ) : !status.codeSent ? (
                <TouchableOpacity style={styles.resendButton} onPress={sendCode}>
                    <RefreshCw size={18} color="#059669" />
                    <Text style={styles.resendText}>Enviar código al cliente</Text>
                </TouchableOpacity>
            ) : (
                <Text style={styles.sentConfirmation}>
                    ✓ Código enviado por WhatsApp
                </Text>
            )}

            {/* Code input */}
            <View style={styles.codeContainer}>
                {[0, 1, 2, 3].map((index) => (
                    <TextInput
                        key={index}
                        ref={(ref: TextInput | null) => {
                            inputRefs.current[index] = ref;
                        }}
                        style={[
                            styles.codeInput,
                            code[index] && styles.codeInputFilled,
                            error && styles.codeInputError,
                        ]}
                        value={code[index]}
                        onChangeText={(value) => handleCodeChange(index, value)}
                        onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                        keyboardType="number-pad"
                        maxLength={1}
                        autoFocus={index === 0 && status.codeSent}
                        selectTextOnFocus
                    />
                ))}
            </View>

            {/* Error message */}
            {error && (
                <View style={styles.errorContainer}>
                    <XCircle size={18} color="#dc2626" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Verify button */}
            <TouchableOpacity
                style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
                onPress={() => verifyCode()}
                disabled={loading || code.join('').length !== 4}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.verifyButtonText}>Verificar Código</Text>
                )}
            </TouchableOpacity>

            {/* Resend option */}
            {status.codeSent && (
                <TouchableOpacity
                    style={styles.resendLink}
                    onPress={sendCode}
                    disabled={sending}
                >
                    <Text style={styles.resendLinkText}>
                        ¿El cliente no recibió el código? Reenviar
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        margin: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    instruction: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 20,
        lineHeight: 24,
    },
    customerName: {
        fontWeight: '600',
        color: '#111827',
    },
    sendingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
        padding: 12,
        backgroundColor: '#f0fdf4',
        borderRadius: 8,
    },
    sendingText: {
        fontSize: 14,
        color: '#059669',
    },
    sentConfirmation: {
        fontSize: 14,
        color: '#059669',
        marginBottom: 20,
        fontWeight: '500',
    },
    resendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
        padding: 12,
        backgroundColor: '#f0fdf4',
        borderRadius: 8,
    },
    resendText: {
        fontSize: 14,
        color: '#059669',
        fontWeight: '500',
    },
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 20,
    },
    codeInput: {
        width: 56,
        height: 64,
        borderWidth: 2,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        color: '#111827',
        backgroundColor: '#f9fafb',
    },
    codeInputFilled: {
        borderColor: '#059669',
        backgroundColor: '#f0fdf4',
    },
    codeInputError: {
        borderColor: '#dc2626',
        backgroundColor: '#fef2f2',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#fef2f2',
        borderRadius: 8,
    },
    errorText: {
        fontSize: 14,
        color: '#dc2626',
        flex: 1,
    },
    verifyButton: {
        backgroundColor: '#059669',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    verifyButtonDisabled: {
        backgroundColor: '#9ca3af',
    },
    verifyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    resendLink: {
        marginTop: 16,
        alignItems: 'center',
    },
    resendLinkText: {
        fontSize: 14,
        color: '#6b7280',
        textDecorationLine: 'underline',
    },
    successContainer: {
        alignItems: 'center',
        padding: 24,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#059669',
        marginTop: 16,
    },
    successText: {
        fontSize: 16,
        color: '#6b7280',
        marginTop: 8,
    },
});

export default ConfirmationCodeEntry;
