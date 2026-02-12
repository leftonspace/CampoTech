/**
 * Invite Acceptance Screen
 * ========================
 *
 * When an owner invites an employee, they receive a WhatsApp message with a deep link
 * containing a token. This screen:
 * 1. Validates the invite token
 * 2. Shows organization and role info
 * 3. Collects employee phone number
 * 4. Verifies OTP
 * 5. Creates account linked to organization
 */

import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, CheckCircle, XCircle, User, Phone } from 'lucide-react-native';

import { api } from '../../../lib/api/client';
import { useAuth } from '../../../lib/auth/auth-context';

interface InviteData {
  organizationName: string;
  organizationLogo?: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
}

type Step = 'loading' | 'info' | 'phone' | 'otp' | 'success' | 'error';

export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>('loading');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const otpInputs = useRef<(TextInput | null)[]>([]);

  // Fetch invite data on mount
  useEffect(() => {
    if (token) {
      fetchInviteData();
    }
  }, [token]);

  const fetchInviteData = async () => {
    try {
      const response = await api.invites.get(token as string);
      if (response.success && response.data) {
        setInviteData(response.data);
        setStep('info');
      } else {
        setError(response.error?.message || 'Invitación no válida o expirada');
        setStep('error');
      }
    } catch {
      setError('Error de conexión');
      setStep('error');
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhone(value);
    setPhone(formatted);
    setError('');
  };

  const handleRequestOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Ingresá un número válido');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await api.invites.requestOtp(token as string, digits);
      if (response.success) {
        setStep('otp');
        setTimeout(() => otpInputs.current[0]?.focus(), 100);
      } else {
        setError(response.error?.message || 'Error al enviar código');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6);
      const newOtp = [...otp];
      digits.split('').forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtp(newOtp);
      if (digits.length === 6) {
        handleVerifyOtp(newOtp.join(''));
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, '');
    setOtp(newOtp);
    setError('');

    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (newOtp.every((d) => d) && newOtp.join('').length === 6) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (code: string) => {
    const digits = phone.replace(/\D/g, '');
    setIsLoading(true);
    setError('');

    try {
      const response = await api.invites.accept(token as string, digits, code);

      if (response.success && response.data) {
        // Use the auth context to complete login
        const loginResult = await login(digits, code);
        if (loginResult.success) {
          setStep('success');
          // Redirect to main app after a short delay
          setTimeout(() => {
            router.replace('/(tabs)/today');
          }, 2000);
        } else {
          setError(loginResult.error || 'Error al iniciar sesión');
          setOtp(['', '', '', '', '', '']);
          otpInputs.current[0]?.focus();
        }
      } else {
        setError(response.error?.message || 'Código inválido');
        setOtp(['', '', '', '', '', '']);
        otpInputs.current[0]?.focus();
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleDisplay = (role: string) => {
    const roles: Record<string, string> = {
      OWNER: 'Dueño',
      ADMIN: 'Administrador',
      TECHNICIAN: 'Técnico',
    };
    return roles[role.toUpperCase()] || role;
  };

  // Loading state
  if (step === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Verificando invitación...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <XCircle size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Invitación no válida</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.buttonText}>Ir a Iniciar Sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <CheckCircle size={64} color="#16a34a" />
          <Text style={styles.successTitle}>¡Bienvenido!</Text>
          <Text style={styles.successMessage}>
            Te uniste a {inviteData?.organizationName}
          </Text>
          <Text style={styles.redirectText}>Redirigiendo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>CampoTech</Text>
            <Text style={styles.title}>Invitación de equipo</Text>
          </View>

          {/* Organization Info Card */}
          {inviteData && (
            <View style={styles.card}>
              <View style={styles.orgInfo}>
                <View style={styles.orgIcon}>
                  <Building2 size={32} color="#16a34a" />
                </View>
                <View style={styles.orgDetails}>
                  <Text style={styles.orgName}>{inviteData.organizationName}</Text>
                  <View style={styles.roleRow}>
                    <User size={14} color="#6b7280" />
                    <Text style={styles.roleText}>
                      Rol: {getRoleDisplay(inviteData.role)}
                    </Text>
                  </View>
                  <Text style={styles.invitedBy}>
                    Invitado por {inviteData.invitedBy}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Info step - Show accept button */}
          {step === 'info' && (
            <View style={styles.form}>
              <Text style={styles.stepTitle}>
                Aceptá la invitación para unirte al equipo
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => setStep('phone')}
              >
                <Text style={styles.buttonText}>Aceptar invitación</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Phone step */}
          {step === 'phone' && (
            <View style={styles.form}>
              <Text style={styles.stepTitle}>
                Ingresá tu número de celular
              </Text>
              <View style={styles.inputContainer}>
                <Phone size={20} color="#6b7280" style={styles.inputIcon} />
                <Text style={styles.countryCode}>+54 9</Text>
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  placeholder="11 1234-5678"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  maxLength={13}
                  autoFocus
                  editable={!isLoading}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleRequestOtp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Continuar</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep('info')}
              >
                <Text style={styles.backText}>Volver</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* OTP step */}
          {step === 'otp' && (
            <View style={styles.form}>
              <Text style={styles.stepTitle}>
                Ingresá el código que recibiste
              </Text>
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => { otpInputs.current[index] = ref; }}
                    style={[
                      styles.otpInput,
                      digit && styles.otpInputFilled,
                      error && styles.otpInputError,
                    ]}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={({ nativeEvent }) =>
                      handleOtpKeyPress(nativeEvent.key, index)
                    }
                    keyboardType="number-pad"
                    maxLength={1}
                    editable={!isLoading}
                    selectTextOnFocus
                  />
                ))}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {isLoading && (
                <ActivityIndicator style={styles.loader} color="#16a34a" />
              )}

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setStep('phone');
                  setOtp(['', '', '', '', '', '']);
                  setError('');
                }}
              >
                <Text style={styles.backText}>Cambiar número</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#16a34a',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orgInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orgIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  orgDetails: {
    flex: 1,
  },
  orgName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  roleText: {
    fontSize: 14,
    color: '#6b7280',
  },
  invitedBy: {
    fontSize: 13,
    color: '#9ca3af',
  },
  form: {
    gap: 16,
  },
  stepTitle: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
  },
  inputIcon: {
    marginRight: 8,
  },
  countryCode: {
    fontSize: 16,
    color: '#374151',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
    color: '#111827',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  otpInputFilled: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  otpInputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 16,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backText: {
    color: '#6b7280',
    fontSize: 14,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  successTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '600',
    color: '#16a34a',
  },
  successMessage: {
    marginTop: 8,
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  redirectText: {
    marginTop: 16,
    fontSize: 14,
    color: '#9ca3af',
  },
});
