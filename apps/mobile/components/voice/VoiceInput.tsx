/**
 * Voice Input Component
 * =====================
 *
 * Phase 9.10: Mobile-First Architecture
 * Voice note recording for job notes and customer communication.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Mic, Square, Send, Trash2, Play, Pause, Loader } from 'lucide-react-native';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface VoiceInputProps {
  onRecordingComplete: (uri: string, duration: number) => Promise<void>;
  onTranscriptionComplete?: (text: string) => void;
  maxDuration?: number; // Max recording duration in seconds
  showTranscription?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

type RecordingState = 'idle' | 'recording' | 'recorded' | 'playing' | 'processing';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function VoiceInput({
  onRecordingComplete,
  onTranscriptionComplete,
  maxDuration = 120, // 2 minutes default
  showTranscription = true,
  placeholder = 'Mantené presionado para grabar',
  disabled = false,
}: VoiceInputProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
          'Necesitamos acceso al micrófono para grabar notas de voz.',
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
    if (disabled) return;

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      setError(null);

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Start recording
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

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const next = prev + 1;
          if (next >= maxDuration) {
            stopRecording();
          }
          return next;
        });
      }, 1000);

      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } catch (err) {
      console.error('Start recording error:', err);
      setError('Error al iniciar grabación');
      setState('idle');
    }
  }, [disabled, maxDuration, pulseAnim]);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop animation
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      // Reset audio mode
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
              setState('recorded');
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

  const pausePlayback = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setState('recorded');
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const sendRecording = useCallback(async () => {
    if (!recordedUri) return;

    setState('processing');

    try {
      await onRecordingComplete(recordedUri, duration);

      // Clean up
      await deleteRecording();
    } catch (err) {
      console.error('Send recording error:', err);
      setError('Error enviando grabación');
      setState('recorded');
    }
  }, [recordedUri, duration, onRecordingComplete]);

  const deleteRecording = useCallback(async () => {
    // Stop playback if playing
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    // Delete file
    if (recordedUri) {
      try {
        await FileSystem.deleteAsync(recordedUri, { idempotent: true });
      } catch {
        // Ignore delete errors
      }
    }

    setRecordedUri(null);
    setDuration(0);
    setPlaybackPosition(0);
    setTranscription(null);
    setState('idle');
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

  if (state === 'idle') {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.recordButton, disabled && styles.disabled]}
          onPressIn={startRecording}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Mic size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.hint}>{placeholder}</Text>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  if (state === 'recording') {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.recordingIndicator, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity
            style={styles.stopButton}
            onPress={stopRecording}
            activeOpacity={0.8}
          >
            <Square size={24} color="#fff" fill="#fff" />
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.duration}>{formatTime(duration)}</Text>
        <Text style={styles.recordingText}>Grabando...</Text>
      </View>
    );
  }

  if (state === 'recorded' || state === 'playing') {
    return (
      <View style={styles.container}>
        <View style={styles.recordedControls}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={state === 'playing' ? pausePlayback : playRecording}
          >
            {state === 'playing' ? (
              <Pause size={20} color="#16a34a" />
            ) : (
              <Play size={20} color="#16a34a" />
            )}
          </TouchableOpacity>

          <View style={styles.waveform}>
            <View style={styles.waveformBar} />
            <View style={[styles.waveformBar, { height: 16 }]} />
            <View style={[styles.waveformBar, { height: 24 }]} />
            <View style={[styles.waveformBar, { height: 12 }]} />
            <View style={[styles.waveformBar, { height: 20 }]} />
            <View style={[styles.waveformBar, { height: 8 }]} />
            <View style={styles.waveformBar} />
          </View>

          <Text style={styles.duration}>
            {state === 'playing' ? formatTime(playbackPosition) : formatTime(duration)}
          </Text>

          <TouchableOpacity style={styles.deleteButton} onPress={deleteRecording}>
            <Trash2 size={18} color="#ef4444" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.sendButton} onPress={sendRecording}>
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {showTranscription && transcription && (
          <Text style={styles.transcription}>{transcription}</Text>
        )}
      </View>
    );
  }

  if (state === 'processing') {
    return (
      <View style={styles.container}>
        <View style={styles.processingContainer}>
          <Loader size={24} color="#16a34a" />
          <Text style={styles.processingText}>Enviando...</Text>
        </View>
      </View>
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
    padding: 16,
  },
  recordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  disabled: {
    backgroundColor: '#9ca3af',
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  error: {
    marginTop: 4,
    fontSize: 12,
    color: '#ef4444',
  },
  recordingIndicator: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  recordingText: {
    marginTop: 4,
    fontSize: 12,
    color: '#ef4444',
  },
  recordedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 24,
    flex: 1,
  },
  waveformBar: {
    width: 3,
    height: 12,
    backgroundColor: '#16a34a',
    borderRadius: 1.5,
  },
  deleteButton: {
    padding: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcription: {
    marginTop: 12,
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
