/**
 * Login Screen
 * ============
 *
 * Phone number OTP authentication with country code selector.
 */

import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { useAuth } from '../../lib/auth/auth-context';
import { api } from '../../lib/api/client';

type Step = 'phone' | 'otp';

// Country codes for phone input - matches web app
const COUNTRY_CODES = [
  { code: '+54', country: 'Argentina', flag: '🇦🇷', format: '9 11 1234-5678', maxDigits: 12, placeholder: '9 11 1234-5678' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸', format: '(xxx) xxx-xxxx', maxDigits: 10, placeholder: '(555) 123-4567' },
  { code: '+52', country: 'México', flag: '🇲🇽', format: 'xx xxxx xxxx', maxDigits: 10, placeholder: '55 1234 5678' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷', format: 'xx xxxxx-xxxx', maxDigits: 11, placeholder: '11 91234-5678' },
  { code: '+56', country: 'Chile', flag: '🇨🇱', format: 'x xxxx xxxx', maxDigits: 9, placeholder: '9 1234 5678' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴', format: 'xxx xxx xxxx', maxDigits: 10, placeholder: '310 123 4567' },
  { code: '+58', country: 'Venezuela', flag: '🇻🇪', format: 'xxx xxx xxxx', maxDigits: 10, placeholder: '412 123 4567' },
  { code: '+34', country: 'España', flag: '🇪🇸', format: 'xxx xx xx xx', maxDigits: 9, placeholder: '612 34 56 78' },
];

// Format phone number based on country
const formatPhoneByCountry = (value: string, countryCode: string): string => {
  const digits = value.replace(/\D/g, '');

  switch (countryCode) {
    case '+54': // Argentina: 9 11 1234-5678
      if (digits.length <= 1) return digits;
      if (digits.length <= 3) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
      if (digits.length <= 7) return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 1)} ${digits.slice(1, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;

    case '+1': // USA/Canada: (555) 123-4567
      if (digits.length <= 3) return digits.length > 0 ? `(${digits}` : '';
      if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;

    case '+52': // México: 55 1234 5678
      if (digits.length <= 2) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)}`;

    case '+55': // Brasil: 11 91234-5678
      if (digits.length <= 2) return digits;
      if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;

    case '+56': // Chile: 9 1234 5678
      if (digits.length <= 1) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 1)} ${digits.slice(1)}`;
      return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;

    case '+57': // Colombia: 310 123 4567
    case '+58': // Venezuela: 412 123 4567
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;

    case '+34': // España: 612 34 56 78
      if (digits.length <= 3) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;

    default:
      return digits;
  }
};

export default function LoginScreen() {
  const { login } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [countryCode, setCountryCode] = useState('+54'); // Default to Argentina
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const otpInputs = useRef<(TextInput | null)[]>([]);

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, selectedCountry.maxDigits);
    const formatted = formatPhoneByCountry(digits, countryCode);
    setPhone(formatted);
    setError('');
  };

  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    setPhone(''); // Clear phone when country changes to avoid format issues
    setShowCountryPicker(false);
  };

  // Get full phone number with country code
  const getFullPhone = () => {
    const phoneDigits = phone.replace(/\D/g, '');
    return `${countryCode}${phoneDigits}`;
  };

  const handleRequestOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
      setError('Ingresá un número válido');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const fullPhone = getFullPhone();
      const response = await api.auth.requestOtp(fullPhone);
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
    const fullPhone = getFullPhone();
    setIsLoading(true);
    setError('');

    try {
      const result = await login(fullPhone, code);
      if (!result.success) {
        setError(result.error || 'Código inválido');
        setOtp(['', '', '', '', '', '']);
        otpInputs.current[0]?.focus();
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtp(['', '', '', '', '', '']);
    await handleRequestOtp();
  };

  const renderCountryItem = ({ item }: { item: typeof COUNTRY_CODES[0] }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => handleCountryChange(item.code)}
    >
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <Text style={styles.countryName}>{item.country}</Text>
      <Text style={styles.countryCodeText}>{item.code}</Text>
      {item.code === countryCode && (
        <Feather name="check" size={20} color="#16a34a" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo/Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>CampoTech</Text>
            <Text style={styles.subtitle}>
              {step === 'phone'
                ? 'Ingresá tu número de celular'
                : 'Ingresá el código que recibiste'}
            </Text>
          </View>

          {/* Form */}
          {step === 'phone' ? (
            <View style={styles.form}>
              <View style={styles.phoneRow}>
                {/* Country Code Selector */}
                <TouchableOpacity
                  style={styles.countrySelector}
                  onPress={() => setShowCountryPicker(true)}
                >
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.selectedCode}>{countryCode}</Text>
                  <Feather name="chevron-down" size={16} color="#6b7280" />
                </TouchableOpacity>

                {/* Phone Input */}
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.phoneInput}
                    value={phone}
                    onChangeText={handlePhoneChange}
                    placeholder={selectedCountry.placeholder}
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    maxLength={selectedCountry.maxDigits + 5}
                    autoFocus
                    editable={!isLoading}
                  />
                </View>
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
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.phoneDisplay}>
                Código enviado a {getFullPhone()}
              </Text>

              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (otpInputs.current[index] = ref)}
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
                style={styles.resendButton}
                onPress={handleResendOtp}
                disabled={isLoading}
              >
                <Text style={styles.resendText}>Reenviar código</Text>
              </TouchableOpacity>

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
        </View>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCountryPicker(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar país</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Feather name="x" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={COUNTRY_CODES}
              renderItem={renderCountryItem}
              keyExtractor={(item) => item.code}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </Pressable>
      </Modal>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#16a34a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: '#f9fafb',
    gap: 6,
  },
  countryFlag: {
    fontSize: 20,
  },
  selectedCode: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 16,
    color: '#111827',
  },
  phoneDisplay: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 8,
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
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendText: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: '500',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backText: {
    color: '#6b7280',
    fontSize: 14,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  countryCodeText: {
    fontSize: 16,
    color: '#6b7280',
    marginRight: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#f3f4f6',
  },
});
