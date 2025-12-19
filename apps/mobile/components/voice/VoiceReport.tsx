/**
 * Voice Report Component
 * ======================
 *
 * Phase 2.3.4: Voice Report Feature
 * Records audio and transcribes using Whisper API.
 * Allows editing of transcribed text before saving.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Feather } from '@expo/vector-icons';
import { api } from '../../lib/api/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface VoiceReportProps {
  onComplete: (text: string, audioUri?: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  maxDuration?: number;
  initialText?: string;
  showAudioPreview?: boolean;
}

type RecordingState =
  | 'idle'
  | 'recording'
  | 'recorded'
  | 'transcribing'
  | 'editing'
  | 'playing';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function VoiceReport({
  onComplete,
  onCancel,
  placeholder = 'Grabá tu reporte de voz...',
  maxDuration = 120,
  initialText = '',
  showAudioPreview = true,
}: VoiceReportProps) {
  const [state, setState] = useState<RecordingState>(
    initialText ? 'editing' : 'idle'
  );
  const [duration, setDuration] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [transcribedText, setTranscribedText] = useState(initialText);
  const [editedText, setEditedText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ═══════════════════════════════════════════════════════════════════════════
  // PERMISSIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const requestPermissions = async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos',
          'Necesitamos acceso al micrófono para grabar reportes de voz.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (err) {
      console.error('Permission error:', err);
      return false;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RECORDING
  // ═══════════════════════════════════════════════════════════════════════════

  const startRecording = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      setError(null);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const next = prev + 1;
          if (next >= maxDuration) {
            stopRecording();
          }
          return next;
        });
      }, 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } catch (err) {
      console.error('Start recording error:', err);
      setError('Error al iniciar grabación');
      setState('idle');
    }
  }, [maxDuration, pulseAnim]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (uri) {
        setRecordedUri(uri);
        setState('recorded');
      } else {
        setState('idle');
        setError('Error guardando grabación');
      }
    } catch (err) {
      console.error('Stop recording error:', err);
      setError('Error al detener grabación');
      setState('idle');
    }
  }, [pulseAnim]);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSCRIPTION (Whisper API)
  // ═══════════════════════════════════════════════════════════════════════════

  const transcribeAudio = useCallback(async () => {
    if (!recordedUri) return;

    setState('transcribing');
    setError(null);

    try {
      const response = await api.transcription.transcribe(recordedUri);

      if (response.success && response.data) {
        const text = response.data.text.trim();
        setTranscribedText(text);
        setEditedText(text);
        setState('editing');
      } else {
        // Fallback: Allow manual text entry if transcription fails
        setError(
          response.error?.message ||
            'No se pudo transcribir. Escribí el texto manualmente.'
        );
        setTranscribedText('');
        setEditedText('');
        setState('editing');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError('Error de transcripción. Escribí el texto manualmente.');
      setState('editing');
    }
  }, [recordedUri]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYBACK
  // ═══════════════════════════════════════════════════════════════════════════

  const playRecording = useCallback(async () => {
    if (!recordedUri) return;

    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPlaybackPosition(status.positionMillis / 1000);
            if (status.didJustFinish) {
              setState('editing');
              setPlaybackPosition(0);
            }
          }
        }
      );

      soundRef.current = sound;
      setState('playing');
    } catch (err) {
      console.error('Playback error:', err);
      setError('Error reproduciendo audio');
    }
  }, [recordedUri]);

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      setState('editing');
      setPlaybackPosition(0);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSave = useCallback(() => {
    if (!editedText.trim()) {
      Alert.alert('Texto vacío', 'Por favor escribí algo para guardar.');
      return;
    }
    onComplete(editedText.trim(), recordedUri || undefined);
  }, [editedText, recordedUri, onComplete]);

  const handleCancel = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    if (recordedUri) {
      try {
        await FileSystem.deleteAsync(recordedUri, { idempotent: true });
      } catch {
        // Ignore
      }
    }

    onCancel?.();
  }, [recordedUri, onCancel]);

  const handleReRecord = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    if (recordedUri) {
      try {
        await FileSystem.deleteAsync(recordedUri, { idempotent: true });
      } catch {
        // Ignore
      }
    }

    setRecordedUri(null);
    setTranscribedText('');
    setEditedText('');
    setDuration(0);
    setState('idle');
    setError(null);
  }, [recordedUri]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // IDLE STATE - Show record button
  if (state === 'idle') {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.recordButton}
          onPress={startRecording}
          activeOpacity={0.8}
        >
          <Feather name="mic" size={32} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.hint}>{placeholder}</Text>
        {error && <Text style={styles.error}>{error}</Text>}

        {onCancel && (
          <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
            <Text style={styles.cancelLinkText}>Escribir manualmente</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // RECORDING STATE
  if (state === 'recording') {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.recordingIndicator,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <TouchableOpacity
            style={styles.stopButton}
            onPress={stopRecording}
            activeOpacity={0.8}
          >
            <Feather name="square" size={28} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.duration}>{formatTime(duration)}</Text>
        <Text style={styles.recordingText}>Grabando...</Text>
        <Text style={styles.maxDurationHint}>
          Máximo {Math.floor(maxDuration / 60)} minutos
        </Text>
      </View>
    );
  }

  // RECORDED - Show transcribe button
  if (state === 'recorded') {
    return (
      <View style={styles.container}>
        <View style={styles.recordedInfo}>
          <Feather name="check-circle" size={24} color="#16a34a" />
          <Text style={styles.recordedText}>
            Grabación completada ({formatTime(duration)})
          </Text>
        </View>

        <View style={styles.recordedActions}>
          <TouchableOpacity
            style={styles.transcribeButton}
            onPress={transcribeAudio}
          >
            <Feather name="type" size={20} color="#fff" />
            <Text style={styles.transcribeButtonText}>Transcribir</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reRecordButton}
            onPress={handleReRecord}
          >
            <Feather name="rotate-ccw" size={18} color="#6b7280" />
            <Text style={styles.reRecordButtonText}>Grabar de nuevo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // TRANSCRIBING STATE
  if (state === 'transcribing') {
    return (
      <View style={styles.container}>
        <View style={styles.transcribingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.transcribingText}>Transcribiendo audio...</Text>
          <Text style={styles.transcribingHint}>
            Esto puede tomar unos segundos
          </Text>
        </View>
      </View>
    );
  }

  // EDITING STATE - Show editable text
  if (state === 'editing' || state === 'playing') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.editContainer}
      >
        {/* Audio playback controls */}
        {showAudioPreview && recordedUri && (
          <View style={styles.playbackBar}>
            <TouchableOpacity
              style={styles.playbackButton}
              onPress={state === 'playing' ? stopPlayback : playRecording}
            >
              <Feather
                name={state === 'playing' ? 'pause' : 'play'}
                size={18}
                color="#16a34a"
              />
            </TouchableOpacity>
            <View style={styles.playbackWaveform}>
              {[...Array(12)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.waveformBar,
                    { height: 8 + Math.random() * 16 },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.playbackTime}>
              {state === 'playing'
                ? formatTime(playbackPosition)
                : formatTime(duration)}
            </Text>
          </View>
        )}

        {/* Editable text */}
        <View style={styles.textInputContainer}>
          {error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color="#f59e0b" />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {transcribedText && transcribedText !== editedText && (
            <TouchableOpacity
              style={styles.restoreButton}
              onPress={() => setEditedText(transcribedText)}
            >
              <Feather name="rotate-ccw" size={14} color="#6b7280" />
              <Text style={styles.restoreButtonText}>
                Restaurar texto original
              </Text>
            </TouchableOpacity>
          )}

          <TextInput
            style={styles.textInput}
            value={editedText}
            onChangeText={setEditedText}
            placeholder="Escribí o editá el texto aquí..."
            placeholderTextColor="#9ca3af"
            multiline
            autoFocus={!transcribedText}
            textAlignVertical="top"
          />
        </View>

        {/* Actions */}
        <View style={styles.editActions}>
          <TouchableOpacity
            style={styles.reRecordSmallButton}
            onPress={handleReRecord}
          >
            <Feather name="mic" size={18} color="#6b7280" />
          </TouchableOpacity>

          {onCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.saveButton,
              !editedText.trim() && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!editedText.trim()}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.saveButtonText}>Guardar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 24,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  hint: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  error: {
    marginTop: 8,
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
  },
  cancelLink: {
    marginTop: 16,
    padding: 8,
  },
  cancelLinkText: {
    fontSize: 14,
    color: '#3b82f6',
    textDecorationLine: 'underline',
  },
  recordingIndicator: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    marginTop: 16,
    fontSize: 32,
    fontWeight: '600',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  recordingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
  },
  maxDurationHint: {
    marginTop: 4,
    fontSize: 12,
    color: '#9ca3af',
  },
  recordedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  recordedText: {
    fontSize: 16,
    color: '#16a34a',
    fontWeight: '500',
  },
  recordedActions: {
    width: '100%',
    gap: 12,
  },
  transcribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
  },
  transcribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  reRecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  reRecordButtonText: {
    fontSize: 14,
    color: '#6b7280',
  },
  transcribingContainer: {
    alignItems: 'center',
    gap: 12,
  },
  transcribingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  transcribingHint: {
    fontSize: 13,
    color: '#6b7280',
  },
  // Edit state
  editContainer: {
    flex: 1,
    padding: 16,
  },
  playbackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  playbackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playbackWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
  },
  waveformBar: {
    width: 3,
    backgroundColor: '#16a34a',
    borderRadius: 1.5,
  },
  playbackTime: {
    fontSize: 13,
    fontWeight: '500',
    color: '#16a34a',
    fontVariant: ['tabular-nums'],
  },
  textInputContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#b45309',
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginBottom: 8,
  },
  restoreButtonText: {
    fontSize: 13,
    color: '#6b7280',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    lineHeight: 24,
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  reRecordSmallButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
