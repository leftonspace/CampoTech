/**
 * Add Team Member Screen
 * ======================
 *
 * Phase 9.10: Mobile-First Architecture
 * Form for adding new team members
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Shield,
  Wrench,
  Check,
  MessageCircle,
} from 'lucide-react-native';

const ROLES = [
  { value: 'TECHNICIAN', label: 'Técnico', description: 'Realiza trabajos asignados' },
  { value: 'DISPATCHER', label: 'Despachador', description: 'Asigna trabajos al equipo' },
  { value: 'ADMIN', label: 'Administrador', description: 'Acceso completo excepto facturación' },
];

const SKILL_LEVELS = [
  { value: 'AYUDANTE', label: 'Ayudante', description: 'En formación' },
  { value: 'MEDIO_OFICIAL', label: 'Medio Oficial', description: '1-3 años experiencia' },
  { value: 'OFICIAL', label: 'Oficial', description: '3-5 años experiencia' },
  { value: 'OFICIAL_ESPECIALIZADO', label: 'Oficial Especializado', description: '+5 años, certificado' },
];

const SPECIALTIES = [
  'Instalación de splits',
  'Reparación de aires',
  'Mantenimiento preventivo',
  'Instalación de calefactores',
  'Refrigeración comercial',
  'Otro',
];

export default function AddTeamMemberScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('TECHNICIAN');
  const [skillLevel, setSkillLevel] = useState('MEDIO_OFICIAL');
  const [specialty, setSpecialty] = useState('');
  const [sendWhatsAppInvite, setSendWhatsAppInvite] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }

    if (!phone.trim()) {
      Alert.alert('Error', 'El teléfono es obligatorio');
      return;
    }

    // Validate phone format
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Error', 'El teléfono debe tener al menos 10 dígitos');
      return;
    }

    setLoading(true);

    try {
      // In production, this would call the API
      await new Promise((resolve) => setTimeout(resolve, 1000));

      Alert.alert(
        'Miembro agregado',
        sendWhatsAppInvite
          ? `${name} fue agregado al equipo. Se envió una invitación por WhatsApp.`
          : `${name} fue agregado al equipo.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar el miembro. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Agregar Técnico</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.form}
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Nombre *</Text>
            <View style={styles.inputContainer}>
              <User size={20} color="#9ca3af" />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Juan Pérez"
                placeholderTextColor="#9ca3af"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.field}>
            <Text style={styles.label}>Teléfono *</Text>
            <View style={styles.inputContainer}>
              <Phone size={20} color="#9ca3af" />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="11 5678 1234"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email (opcional)</Text>
            <View style={styles.inputContainer}>
              <Mail size={20} color="#9ca3af" />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="juan@email.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Role */}
          <View style={styles.field}>
            <Text style={styles.label}>Rol</Text>
            <View style={styles.optionGroup}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[
                    styles.optionCard,
                    role === r.value && styles.optionCardSelected,
                  ]}
                  onPress={() => setRole(r.value)}
                >
                  <View style={styles.optionHeader}>
                    <Text
                      style={[
                        styles.optionLabel,
                        role === r.value && styles.optionLabelSelected,
                      ]}
                    >
                      {r.label}
                    </Text>
                    {role === r.value && <Check size={16} color="#059669" />}
                  </View>
                  <Text style={styles.optionDescription}>{r.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Skill Level */}
          <View style={styles.field}>
            <Text style={styles.label}>Nivel de habilidad (UOCRA)</Text>
            <View style={styles.optionGroup}>
              {SKILL_LEVELS.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[
                    styles.optionCard,
                    skillLevel === s.value && styles.optionCardSelected,
                  ]}
                  onPress={() => setSkillLevel(s.value)}
                >
                  <View style={styles.optionHeader}>
                    <Text
                      style={[
                        styles.optionLabel,
                        skillLevel === s.value && styles.optionLabelSelected,
                      ]}
                    >
                      {s.label}
                    </Text>
                    {skillLevel === s.value && <Check size={16} color="#059669" />}
                  </View>
                  <Text style={styles.optionDescription}>{s.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Specialty */}
          <View style={styles.field}>
            <Text style={styles.label}>Especialidad</Text>
            <View style={styles.chipGroup}>
              {SPECIALTIES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, specialty === s && styles.chipSelected]}
                  onPress={() => setSpecialty(specialty === s ? '' : s)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      specialty === s && styles.chipTextSelected,
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* WhatsApp Invite */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setSendWhatsAppInvite(!sendWhatsAppInvite)}
          >
            <View
              style={[styles.checkbox, sendWhatsAppInvite && styles.checkboxChecked]}
            >
              {sendWhatsAppInvite && <Check size={14} color="#fff" />}
            </View>
            <MessageCircle size={20} color="#25D366" />
            <Text style={styles.checkboxLabel}>Enviar invitación por WhatsApp</Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Agregando...' : 'Agregar miembro'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    paddingBottom: 40,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  optionGroup: {
    gap: 8,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
  },
  optionCardSelected: {
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  optionLabelSelected: {
    color: '#059669',
  },
  optionDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  chipText: {
    fontSize: 14,
    color: '#374151',
  },
  chipTextSelected: {
    color: '#fff',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },
  submitButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
