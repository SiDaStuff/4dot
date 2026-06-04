import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';

export interface UserSettings {
  soundEnabled: boolean;
  soundVolume: number;
  moveAnimationEnabled: boolean;
  lastMoveHighlightEnabled: boolean;
  pulseOnTurnEnabled: boolean;
  boardFlipped: boolean;
  premoveEnabled: boolean;
  keyboardShortcutsEnabled: boolean;
  defaultGameMode: 'rated' | 'casual';
  defaultTimeControl: number;
  showActivityFeed: boolean;
  blockedUsers: string[];
  mutedUsers: string[];
}

const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: true,
  soundVolume: 0.5,
  moveAnimationEnabled: true,
  lastMoveHighlightEnabled: true,
  pulseOnTurnEnabled: true,
  boardFlipped: false,
  premoveEnabled: true,
  keyboardShortcutsEnabled: true,
  defaultGameMode: 'rated',
  defaultTimeControl: 180000,
  showActivityFeed: true,
  blockedUsers: [],
  mutedUsers: [],
};

const STORAGE_KEY = '4dot_settings';

function loadSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: UserSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

interface SettingsContextType {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  updateSettings: (partial: Partial<UserSettings>) => void;
  resetSettings: () => void;
  isBlocked: (uid: string) => boolean;
  isMuted: (uid: string) => boolean;
  blockUser: (uid: string) => void;
  unblockUser: (uid: string) => void;
  muteUser: (uid: string) => void;
  unmuteUser: (uid: string) => void;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSetting: () => {},
  updateSettings: () => {},
  resetSettings: () => {},
  isBlocked: () => false,
  isMuted: () => false,
  blockUser: () => {},
  unblockUser: () => {},
  muteUser: () => {},
  unmuteUser: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateSettings = useCallback((partial: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const isBlocked = useCallback((uid: string) => {
    return settingsRef.current.blockedUsers.includes(uid);
  }, []);

  const isMuted = useCallback((uid: string) => {
    return settingsRef.current.mutedUsers.includes(uid);
  }, []);

  const blockUser = useCallback((uid: string) => {
    setSettings(prev => {
      if (prev.blockedUsers.includes(uid)) return prev;
      return { ...prev, blockedUsers: [...prev.blockedUsers, uid] };
    });
  }, []);

  const unblockUser = useCallback((uid: string) => {
    setSettings(prev => ({
      ...prev,
      blockedUsers: prev.blockedUsers.filter(u => u !== uid),
    }));
  }, []);

  const muteUser = useCallback((uid: string) => {
    setSettings(prev => {
      if (prev.mutedUsers.includes(uid)) return prev;
      return { ...prev, mutedUsers: [...prev.mutedUsers, uid] };
    });
  }, []);

  const unmuteUser = useCallback((uid: string) => {
    setSettings(prev => ({
      ...prev,
      mutedUsers: prev.mutedUsers.filter(u => u !== uid),
    }));
  }, []);

  const value = useMemo(() => ({
    settings, updateSetting, updateSettings, resetSettings,
    isBlocked, isMuted, blockUser, unblockUser, muteUser, unmuteUser,
  }), [settings, updateSetting, updateSettings, resetSettings, isBlocked, isMuted, blockUser, unblockUser, muteUser, unmuteUser]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
