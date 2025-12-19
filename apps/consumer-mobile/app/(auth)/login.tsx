/**
 * Login Screen - Consumer App
 * ===========================
 *
 * Phone + OTP authentication for consumers.
 * Simple auth - no password, no email required.
 * Account is optional - only needed for:
 * - Saving favorite providers
 * - Viewing booking history
 * - Submitting ratings
 */

import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Phone, ArrowRight, RefreshCw } from 'lucide-react-native';

type AuthStep = 'phone' | 'otp';

export default function LoginScreen() {
  const [step, setStep] = useState<AuthStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // OTP input refs
  const otpRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatPhoneNumber = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');

    // Format as Argentine phone number
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 10)
      return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setPhoneNumber(formatted);
  };

  const validatePhone = () => {
    const digits = phoneNumber.replace(/\D/g, '');
    return digits.length >= 10;
  };

  const handleSendOtp = async () => {
    if (!validatePhone()) {
      Alert.alert('Error', 'Por favor ingresá un número de teléfono válido');
      return;
    }

    setIsLoading(true);

    try {
      // Simulate OTP send - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setStep('otp');
      setCountdown(60);

      // Focus first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (error) {
      Alert.alert('Error', 'No se pudo enviar el código. Intentá de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').slice(0, 6);
      const newOtp = [...otp];
      digits.split('').forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);

      // Focus last filled or next empty
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
    } else {
      // Single digit
      const newOtp = [...otp];
      newOtp[index] = value.replace(/\D/g, '');
      setOtp(newOtp);

      // Auto-focus next input
      if (value && index < 5) {
        otpRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      Alert.alert('Error', 'Por favor ingresá el código completo de 6 dígitos');
      return;
    }

    setIsLoading(true);

    try {
      // Simulate OTP verification - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Success - navigate to home
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Código incorrecto. Intentá de nuevo.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;

    setIsLoading(true);

    try {
      // Simulate OTP resend
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      Alert.alert('Código enviado', 'Te enviamos un nuevo código por SMS');
    } catch (error) {
      Alert.alert('Error', 'No se pudo reenviar el código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep('phone');
    setOtp(['', '', '', '', '', '']);
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'phone' ? (
          <>
            {/* Phone Step */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Phone size={32} color="#059669" />
              </View>
              <Text style={styles.title}>Ingresá tu teléfono</Text>
              <Text style={styles.subtitle}>
                Te enviaremos un código por SMS para verificar tu número
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.phoneInputContainer}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryFlag}>🇦🇷</Text>
                  <Text style={styles.countryCodeText}>+54</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="11 1234-5678"
                  placeholderTextColor="#9ca3af"
                  value={phoneNumber}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={14}
                  autoFocus
                />
              </View>

              <Pressable
                style={[
                  styles.submitButton,
                  (!validatePhone() || isLoading) && styles.submitButtonDisabled,
                ]}
                onPress={handleSendOtp}
                disabled={!validatePhone() || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Enviar código</Text>
                    <ArrowRight size={20} color="#fff" />
                  </>
                )}
              </Pressable>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>¿Para qué necesito una cuenta?</Text>
              <Text style={styles.infoText}>
                La cuenta es opcional. Te permite guardar favoritos, ver tu historial
                y calificar servicios. Podés navegar sin cuenta.
              </Text>
            </View>

            <Pressable style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Continuar sin cuenta</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* OTP Step */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Text style={styles.iconEmoji}>📱</Text>
              </View>
              <Text style={styles.title}>Verificá tu número</Text>
              <Text style={styles.subtitle}>
                Ingresá el código de 6 dígitos que enviamos a{'\n'}
                <Text style={styles.phoneHighlight}>+54 {phoneNumber}</Text>
              </Text>
            </View>

            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (otpRefs.current[index] = ref)}
                  style={[
                    styles.otpInput,
                    digit && styles.otpInputFilled,
                  ]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={({ nativeEvent }) =>
                    handleOtpKeyPress(nativeEvent.key, index)
                  }
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            <Pressable
              style={[
                styles.submitButton,
                (otp.join('').length !== 6 || isLoading) && styles.submitButtonDisabled,
              ]}
              onPress={handleVerifyOtp}
              disabled={otp.join('').length !== 6 || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Verificar</Text>
              )}
            </Pressable>

            <View style={styles.resendContainer}>
              {countdown > 0 ? (
                <Text style={styles.countdownText}>
                  Podés reenviar el código en {countdown}s
                </Text>
              ) : (
                <Pressable
                  style={styles.resendButton}
                  onPress={handleResendOtp}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} color="#059669" />
                  <Text style={styles.resendButtonText}>Reenviar código</Text>
                </Pressable>
              )}
            </View>

            <Pressable style={styles.changePhoneButton} onPress={handleBackToPhone}>
              <Text style={styles.changePhoneText}>Cambiar número de teléfono</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneHighlight: {
    fontWeight: '600',
    color: '#111827',
  },
  form: {
    gap: 20,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    backgroundColor: '#f3f4f6',
    gap: 6,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    fontSize: 18,
    fontWeight: '500',
    color: '#111827',
    letterSpacing: 0.5,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginTop: 32,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
  },
  skipButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
    color: '#111827',
  },
  otpInputFilled: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  countdownText: {
    fontSize: 14,
    color: '#6b7280',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resendButtonText: {
    fontSize: 15,
    color: '#059669',
    fontWeight: '500',
  },
  changePhoneButton: {
    alignItems: 'center',
    marginTop: 24,
  },
  changePhoneText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
