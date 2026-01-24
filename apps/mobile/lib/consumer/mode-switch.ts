/**
 * Mode Switch
 * ===========
 *
 * Phase 15: Consumer Marketplace
 * Handle switching between consumer and business modes.
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../api/client';

type AppMode = 'consumer' | 'business';

const MODE_STORAGE_KEY = 'campotech_app_mode';

interface UserProfiles {
  businessProfile?: {
    id: string;
    organizationId: string;
    displayName: string;
  };
  consumerProfile?: {
    id: string;
    firstName: string;
  };
}

interface UseAppModeReturn {
  mode: AppMode;
  hasBusinessProfile: boolean;
  hasConsumerProfile: boolean;
  isLoading: boolean;
  switchToBusinessMode: () => Promise<void>;
  switchToConsumerMode: () => Promise<void>;
  checkProfiles: () => Promise<UserProfiles>;
}

export function useAppMode(): UseAppModeReturn {
  const router = useRouter();
  const [mode, setMode] = useState<AppMode>('consumer');
  const [profiles, setProfiles] = useState<UserProfiles>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMode();
    checkProfiles();
  }, []);

  const loadMode = async () => {
    try {
      const savedMode = await AsyncStorage.getItem(MODE_STORAGE_KEY);
      if (savedMode === 'business' || savedMode === 'consumer') {
        setMode(savedMode);
      }
    } catch (error) {
      console.error('Failed to load mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveMode = async (newMode: AppMode) => {
    try {
      await AsyncStorage.setItem(MODE_STORAGE_KEY, newMode);
      setMode(newMode);

      // Record mode switch for analytics
      await apiRequest('/consumer/mode-switch/log', {
        method: 'POST',
        body: { targetMode: newMode },
      });
    } catch (error) {
      console.error('Failed to save mode:', error);
    }
  };

  const checkProfiles = useCallback(async (): Promise<UserProfiles> => {
    try {
      const response = await apiRequest<UserProfiles>('/consumer/mode-switch/profiles');
      if (response.success && response.data) {
        setProfiles(response.data);
        return response.data;
      }
    } catch (error) {
      console.error('Failed to check profiles:', error);
    }
    return {};
  }, []);

  const switchToBusinessMode = useCallback(async () => {
    if (!profiles.businessProfile) {
      // User doesn't have a business profile
      throw new Error('No business profile available');
    }

    await saveMode('business');

    // Navigate to business tabs
    router.replace('/(tabs)/today');
  }, [profiles, router]);

  const switchToConsumerMode = useCallback(async () => {
    await saveMode('consumer');

    // Navigate to consumer tabs
    router.replace('/(consumer)/' as any);
  }, [router]);

  return {
    mode,
    hasBusinessProfile: !!profiles.businessProfile,
    hasConsumerProfile: !!profiles.consumerProfile,
    isLoading,
    switchToBusinessMode,
    switchToConsumerMode,
    checkProfiles,
  };
}

export default useAppMode;
