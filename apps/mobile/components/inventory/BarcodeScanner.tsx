/**
 * Barcode Scanner Component
 * =========================
 *
 * Camera-based barcode scanner for quick product lookup.
 * Uses dynamic imports to prevent expo-camera web code from loading on native.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

// Types for expo-camera (defined locally to avoid import-time issues)
interface BarcodeScanningResult {
  data: string;
  type: string;
}

interface PermissionResponse {
  granted: boolean;
  canAskAgain: boolean;
}

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (barcode: string, type: string) => void;
}

export default function BarcodeScanner({
  visible,
  onClose,
  onScan,
}: BarcodeScannerProps) {
  const [cameraModule, setCameraModule] = useState<any>(null);
  const [permission, setPermission] = useState<PermissionResponse | null>(null);
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const moduleLoadAttempted = useRef(false);

  // Dynamically load expo-camera only when component mounts
  useEffect(() => {
    if (moduleLoadAttempted.current) return;
    moduleLoadAttempted.current = true;

    // Only load expo-camera on native platforms
    if (Platform.OS === 'web') {
      setIsLoading(false);
      return;
    }

    import('expo-camera')
      .then((module) => {
        setCameraModule(module);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load expo-camera:', err);
        setIsLoading(false);
      });
  }, []);

  // Request permissions when camera module is loaded and modal becomes visible
  useEffect(() => {
    if (!cameraModule || !visible) return;

    const checkAndRequestPermission = async () => {
      try {
        const currentPermission = await cameraModule.Camera.getCameraPermissionsAsync();
        if (currentPermission.granted) {
          setPermission(currentPermission);
        } else {
          const newPermission = await cameraModule.Camera.requestCameraPermissionsAsync();
          setPermission(newPermission);
        }
      } catch (err) {
        console.error('Permission error:', err);
      }
    };

    checkAndRequestPermission();
  }, [cameraModule, visible]);

  // Reset scanned state when modal opens
  useEffect(() => {
    if (visible) {
      setScanned(false);
    }
  }, [visible]);

  const handleBarCodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanned) return;

      setScanned(true);
      onScan(result.data, result.type);
    },
    [scanned, onScan]
  );

  const handleScanAgain = useCallback(() => {
    setScanned(false);
  }, []);

  const requestPermission = useCallback(async () => {
    if (!cameraModule) return;
    try {
      const newPermission = await cameraModule.Camera.requestCameraPermissionsAsync();
      setPermission(newPermission);
    } catch (err) {
      console.error('Permission request error:', err);
    }
  }, [cameraModule]);

  if (!visible) return null;

  // Loading state while expo-camera loads
  if (isLoading) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <ActivityIndicator size="large" color="#16a34a" />
            <Text style={styles.permissionTitle}>Cargando cámara...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Web platform fallback
  if (Platform.OS === 'web' || !cameraModule) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <Feather name="camera-off" size={64} color="#9ca3af" />
            <Text style={styles.permissionTitle}>Cámara no disponible</Text>
            <Text style={styles.permissionText}>
              El escáner de códigos no está disponible en esta plataforma
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Permission not granted
  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={styles.container}>
          <View style={styles.permissionContainer}>
            <Feather name="camera-off" size={64} color="#9ca3af" />
            <Text style={styles.permissionTitle}>Permiso de cámara</Text>
            <Text style={styles.permissionText}>
              Necesitamos acceso a la cámara para escanear códigos de barras
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>Permitir acceso</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  const CameraView = cameraModule.CameraView;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'code128', 'code39', 'qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Escanear código</Text>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setTorch(!torch)}
            >
              <Feather
                name={torch ? 'zap-off' : 'zap'}
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {/* Scanner frame */}
          <View style={styles.frameContainer}>
            <View style={styles.frame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
          </View>

          {/* Instructions */}
          <View style={styles.instructions}>
            {scanned ? (
              <TouchableOpacity
                style={styles.scanAgainButton}
                onPress={handleScanAgain}
              >
                <Feather name="refresh-cw" size={20} color="#fff" />
                <Text style={styles.scanAgainText}>Escanear de nuevo</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.instructionText}>
                Alinea el código de barras dentro del marco
              </Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');
const FRAME_SIZE = width * 0.7;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
  },
  permissionText: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 12,
  },
  permissionButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    marginTop: 16,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  frameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE * 0.6,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#16a34a',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructions: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 15,
    color: '#fff',
    opacity: 0.8,
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  scanAgainText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
});
