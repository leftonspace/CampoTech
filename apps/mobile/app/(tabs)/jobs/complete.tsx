/**
 * Job Completion Screen
 * =====================
 *
 * Multi-step flow for completing a job:
 * 1. Notes and materials used
 * 2. Photo capture
 * 3. Signature capture
 */

import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import SignatureCanvas from 'react-native-signature-canvas';

import { jobsCollection, jobPhotosCollection, database } from '../../../watermelon/database';
import { Job } from '../../../watermelon/models';
import { enqueueOperation } from '../../../lib/sync/sync-engine';

type Step = 'notes' | 'photos' | 'signature';

interface Material {
  name: string;
  quantity: number;
  price: number;
}

export default function CompleteJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const signatureRef = useRef<any>(null);

  const [step, setStep] = useState<Step>('notes');
  const [notes, setNotes] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [newMaterial, setNewMaterial] = useState({ name: '', quantity: '1', price: '' });
  const [photos, setPhotos] = useState<string[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddMaterial = () => {
    if (!newMaterial.name || !newMaterial.price) {
      Alert.alert('Error', 'Completá nombre y precio del material');
      return;
    }

    setMaterials([
      ...materials,
      {
        name: newMaterial.name,
        quantity: parseInt(newMaterial.quantity) || 1,
        price: parseFloat(newMaterial.price) || 0,
      },
    ]);
    setNewMaterial({ name: '', quantity: '1', price: '' });
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a las fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      setPhotos([...photos, ...result.assets.map((a) => a.uri)]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSignatureEnd = () => {
    signatureRef.current?.readSignature();
  };

  const handleSignatureOK = (sig: string) => {
    setSignature(sig);
  };

  const handleClearSignature = () => {
    signatureRef.current?.clearSignature();
    setSignature(null);
  };

  const handleSubmit = async () => {
    if (!id) return;

    setIsSubmitting(true);
    try {
      // Get the job
      const job = (await jobsCollection.find(id)) as Job;

      // Complete the job
      await job.completeJob(notes, materials, signature || undefined);

      // Save photos to local database
      await database.write(async () => {
        for (const photoUri of photos) {
          await jobPhotosCollection.create((photo: any) => {
            photo.jobId = id;
            photo.localUri = photoUri;
            photo.type = 'after';
            photo.uploaded = false;
            photo.createdAt = new Date();
          });
        }
      });

      // Queue for sync
      await enqueueOperation(
        'job',
        job.serverId,
        'update',
        {
          status: 'completed',
          completionNotes: notes,
          materialsUsed: materials,
          signatureUrl: signature,
          actualEnd: Date.now(),
        },
        10 // High priority
      );

      Alert.alert('Trabajo completado', 'Los datos se sincronizarán cuando haya conexión', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'No se pudo completar el trabajo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotal = () => {
    const subtotal = materials.reduce((sum, m) => sum + m.quantity * m.price, 0);
    const tax = subtotal * 0.21;
    return { subtotal, tax, total: subtotal + tax };
  };

  const totals = calculateTotal();

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {(['notes', 'photos', 'signature'] as Step[]).map((s, i) => (
        <View key={s} style={styles.stepItem}>
          <View
            style={[
              styles.stepDot,
              step === s && styles.stepDotActive,
              (['notes', 'photos', 'signature'].indexOf(step) > i) && styles.stepDotCompleted,
            ]}
          >
            {['notes', 'photos', 'signature'].indexOf(step) > i ? (
              <Feather name="check" size={12} color="#fff" />
            ) : (
              <Text style={[styles.stepNumber, step === s && styles.stepNumberActive]}>
                {i + 1}
              </Text>
            )}
          </View>
          <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>
            {s === 'notes' && 'Notas'}
            {s === 'photos' && 'Fotos'}
            {s === 'signature' && 'Firma'}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: 'Completar trabajo',
          headerStyle: { backgroundColor: '#16a34a' },
          headerTintColor: '#fff',
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {renderStepIndicator()}

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Step 1: Notes */}
          {step === 'notes' && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>Notas del trabajo</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Descripción del trabajo realizado..."
                placeholderTextColor="#9ca3af"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.sectionTitle}>Materiales utilizados</Text>
              {materials.map((material, index) => (
                <View key={index} style={styles.materialItem}>
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialName}>{material.name}</Text>
                    <Text style={styles.materialDetails}>
                      {material.quantity} x ${material.price.toLocaleString('es-AR')}
                    </Text>
                  </View>
                  <Text style={styles.materialTotal}>
                    ${(material.quantity * material.price).toLocaleString('es-AR')}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveMaterial(index)}>
                    <Feather name="x" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}

              <View style={styles.addMaterialForm}>
                <TextInput
                  style={styles.materialInput}
                  placeholder="Material"
                  placeholderTextColor="#9ca3af"
                  value={newMaterial.name}
                  onChangeText={(text) => setNewMaterial({ ...newMaterial, name: text })}
                />
                <TextInput
                  style={[styles.materialInput, styles.smallInput]}
                  placeholder="Cant"
                  placeholderTextColor="#9ca3af"
                  value={newMaterial.quantity}
                  onChangeText={(text) => setNewMaterial({ ...newMaterial, quantity: text })}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.materialInput, styles.smallInput]}
                  placeholder="Precio"
                  placeholderTextColor="#9ca3af"
                  value={newMaterial.price}
                  onChangeText={(text) => setNewMaterial({ ...newMaterial, price: text })}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity style={styles.addButton} onPress={handleAddMaterial}>
                  <Feather name="plus" size={20} color="#16a34a" />
                </TouchableOpacity>
              </View>

              {materials.length > 0 && (
                <View style={styles.totals}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={styles.totalValue}>
                      ${totals.subtotal.toLocaleString('es-AR')}
                    </Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>IVA (21%)</Text>
                    <Text style={styles.totalValue}>
                      ${totals.tax.toLocaleString('es-AR')}
                    </Text>
                  </View>
                  <View style={[styles.totalRow, styles.grandTotal]}>
                    <Text style={styles.grandTotalLabel}>Total</Text>
                    <Text style={styles.grandTotalValue}>
                      ${totals.total.toLocaleString('es-AR')}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Step 2: Photos */}
          {step === 'photos' && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>Fotos del trabajo</Text>
              <Text style={styles.hint}>
                Tomá fotos del trabajo completado para documentación
              </Text>

              <View style={styles.photoGrid}>
                {photos.map((uri, index) => (
                  <View key={index} style={styles.photoItem}>
                    <Image source={{ uri }} style={styles.photo} />
                    <TouchableOpacity
                      style={styles.removePhoto}
                      onPress={() => handleRemovePhoto(index)}
                    >
                      <Feather name="x" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {photos.length < 5 && (
                  <View style={styles.addPhotoButtons}>
                    <TouchableOpacity style={styles.addPhotoButton} onPress={handleTakePhoto}>
                      <Feather name="camera" size={24} color="#6b7280" />
                      <Text style={styles.addPhotoText}>Cámara</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickPhoto}>
                      <Feather name="image" size={24} color="#6b7280" />
                      <Text style={styles.addPhotoText}>Galería</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Step 3: Signature */}
          {step === 'signature' && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>Firma del cliente</Text>
              <Text style={styles.hint}>
                Pedí al cliente que firme para confirmar la finalización del trabajo
              </Text>

              <View style={styles.signatureContainer}>
                <SignatureCanvas
                  ref={signatureRef}
                  onOK={handleSignatureOK}
                  onEnd={handleSignatureEnd}
                  webStyle={`
                    .m-signature-pad {
                      box-shadow: none;
                      border: 1px solid #e5e7eb;
                      border-radius: 12px;
                    }
                    .m-signature-pad--body {
                      border: none;
                    }
                  `}
                  descriptionText=""
                  clearText="Borrar"
                  confirmText="Guardar"
                  backgroundColor="#fff"
                  penColor="#111827"
                />
              </View>

              <TouchableOpacity style={styles.clearSignature} onPress={handleClearSignature}>
                <Feather name="trash-2" size={16} color="#ef4444" />
                <Text style={styles.clearSignatureText}>Borrar firma</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Navigation buttons */}
        <View style={styles.footer}>
          {step !== 'notes' && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                setStep(step === 'signature' ? 'photos' : 'notes')
              }
            >
              <Feather name="arrow-left" size={20} color="#6b7280" />
              <Text style={styles.backButtonText}>Anterior</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextButton,
              step === 'notes' && styles.nextButtonFull,
              isSubmitting && styles.buttonDisabled,
            ]}
            onPress={() => {
              if (step === 'notes') setStep('photos');
              else if (step === 'photos') setStep('signature');
              else handleSubmit();
            }}
            disabled={isSubmitting}
          >
            <Text style={styles.nextButtonText}>
              {step === 'signature' ? 'Completar trabajo' : 'Siguiente'}
            </Text>
            <Feather
              name={step === 'signature' ? 'check' : 'arrow-right'}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#16a34a',
  },
  stepDotCompleted: {
    backgroundColor: '#16a34a',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  stepNumberActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 12,
    color: '#9ca3af',
  },
  stepLabelActive: {
    color: '#16a34a',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  stepContent: {},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  materialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  materialDetails: {
    fontSize: 12,
    color: '#6b7280',
  },
  materialTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    marginRight: 12,
  },
  addMaterialForm: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  materialInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
  },
  smallInput: {
    flex: 0.3,
  },
  addButton: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totals: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 14,
    color: '#374151',
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16a34a',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoItem: {
    position: 'relative',
    width: '30%',
    aspectRatio: 1,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 4,
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoButton: {
    width: 100,
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  signatureContainer: {
    height: 300,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  clearSignature: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
  },
  clearSignatureText: {
    fontSize: 14,
    color: '#ef4444',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#16a34a',
    borderRadius: 12,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
