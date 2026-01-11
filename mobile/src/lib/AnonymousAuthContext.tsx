import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';
import type { AnonymousUser, AnonymousAuthResponse } from './auth-types';

// Secure storage keys
const STORAGE_KEYS = {
  UUID: 'anonymous_uuid',
  PASSKEY: 'anonymous_passkey',
  TOKEN: 'anonymous_token',
} as const;

interface AnonymousAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AnonymousUser | null;
  token: string | null;
  /** Credentials shown to user for backup (only available after registration) */
  credentials: { uuid: string; passkey: string } | null;
}

interface AnonymousAuthContextType extends AnonymousAuthState {
  /** 
   * Register new anonymous account.
   * Credentials will be available in state.credentials after success.
   */
  register: () => Promise<void>;
  /** 
   * Login with existing UUID + passkey.
   * Used for multi-device access or account recovery.
   */
  login: (uuid: string, passkey: string) => Promise<void>;
  /** Clear credentials display (user has saved them) */
  clearCredentialsDisplay: () => void;
  /** Logout and clear all stored data */
  logout: () => Promise<void>;
  /** Get stored credentials for display in settings */
  getStoredCredentials: () => Promise<{ uuid: string; passkey: string } | null>;
}

const AnonymousAuthContext = createContext<AnonymousAuthContextType | null>(null);

export function useAnonymousAuth() {
  const context = useContext(AnonymousAuthContext);
  if (!context) {
    throw new Error('useAnonymousAuth must be used within AnonymousAuthProvider');
  }
  return context;
}

interface Props {
  children: ReactNode;
}

export function AnonymousAuthProvider({ children }: Props) {
  const [state, setState] = useState<AnonymousAuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    token: null,
    credentials: null,
  });

  // Try to restore session on mount
  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const [uuid, passkey, token] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.UUID),
        SecureStore.getItemAsync(STORAGE_KEYS.PASSKEY),
        SecureStore.getItemAsync(STORAGE_KEYS.TOKEN),
      ]);

      if (uuid && passkey) {
        // We have stored credentials, try to login/refresh
        try {
          let response: AnonymousAuthResponse;
          
          if (token) {
            // Try to refresh with existing token first
            try {
              response = await api.anonymousRefresh(token);
            } catch {
              // Token expired, login with credentials
              response = await api.anonymousLogin({ uuid, passkey });
            }
          } else {
            // No token, login with credentials
            response = await api.anonymousLogin({ uuid, passkey });
          }

          await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, response.accessToken);

          setState({
            isLoading: false,
            isAuthenticated: true,
            user: response.user,
            token: response.accessToken,
            credentials: null,
          });
          return;
        } catch (error) {
          console.error('Failed to restore session:', error);
          // Clear invalid stored data
          await clearStorage();
        }
      }

      // No stored credentials or restoration failed
      setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        token: null,
        credentials: null,
      });
    } catch (error) {
      console.error('Error restoring session:', error);
      setState({
        isLoading: false,
        isAuthenticated: false,
        user: null,
        token: null,
        credentials: null,
      });
    }
  };

  const register = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await api.anonymousRegister();

      if (!response.credentials) {
        throw new Error('No credentials returned from registration');
      }

      // Store credentials securely
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.UUID, response.credentials.uuid),
        SecureStore.setItemAsync(STORAGE_KEYS.PASSKEY, response.credentials.passkey),
        SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, response.accessToken),
      ]);

      setState({
        isLoading: false,
        isAuthenticated: true,
        user: response.user,
        token: response.accessToken,
        // Show credentials to user so they can save them
        credentials: response.credentials,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const login = useCallback(async (uuid: string, passkey: string) => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const response = await api.anonymousLogin({ uuid, passkey });

      // Store credentials securely
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.UUID, uuid),
        SecureStore.setItemAsync(STORAGE_KEYS.PASSKEY, passkey),
        SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, response.accessToken),
      ]);

      setState({
        isLoading: false,
        isAuthenticated: true,
        user: response.user,
        token: response.accessToken,
        credentials: null,
      });
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const clearCredentialsDisplay = useCallback(() => {
    setState(prev => ({ ...prev, credentials: null }));
  }, []);

  const logout = useCallback(async () => {
    await clearStorage();
    setState({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      token: null,
      credentials: null,
    });
  }, []);

  const getStoredCredentials = useCallback(async () => {
    const [uuid, passkey] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.UUID),
      SecureStore.getItemAsync(STORAGE_KEYS.PASSKEY),
    ]);

    if (uuid && passkey) {
      return { uuid, passkey };
    }
    return null;
  }, []);

  const clearStorage = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.UUID),
      SecureStore.deleteItemAsync(STORAGE_KEYS.PASSKEY),
      SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN),
    ]);
  };

  return (
    <AnonymousAuthContext.Provider
      value={{
        ...state,
        register,
        login,
        clearCredentialsDisplay,
        logout,
        getStoredCredentials,
      }}
    >
      {children}
    </AnonymousAuthContext.Provider>
  );
}
