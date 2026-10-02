import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginParent, verifyCurrentSession } from '../api/authApi';
import { clearStoredToken, getStoredToken, saveStoredToken, API_BASE_URL, setApiBaseUrl } from '../api/client';
import { registerPushTokenWithBackend, unregisterPushTokenFromBackend } from '../services/notificationService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [serverUrl, setServerUrl] = useState(API_BASE_URL);

  const clearError = () => setAuthError('');

  const updateServerUrl = (newUrl) => {
    if (!newUrl || typeof newUrl !== 'string') return false;
    const sanitized = newUrl.trim().replace(/\/+$/, '');
    setApiBaseUrl(sanitized);
    setServerUrl(sanitized);
    return true;
  };

  // 1. Session Restore on App Startup
  useEffect(() => {
    async function restoreSession() {
      try {
        const token = await getStoredToken();
        if (!token) {
          setLoading(false);
          return;
        }

        const data = await verifyCurrentSession();
        if (data?.user) {
          if (data.user.role !== 'PARENT') {
            await clearStoredToken();
            setUser(null);
            setAuthError('Access denied: Parent credentials required.');
          } else {
            setUser(data.user);
            // Re-sync push notification token silently on session restore
            registerPushTokenWithBackend().catch(() => {});
          }
        } else {
          await clearStoredToken();
          setUser(null);
        }
      } catch (err) {
        console.warn('[AuthContext] Session restore failed:', err.message);
        await clearStoredToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, []);

  // 2. Parent Login Action
  async function login(identifier, password) {
    setIsAuthenticating(true);
    setAuthError('');
    try {
      const result = await loginParent(identifier, password);

      if (!result?.token || !result?.user) {
        throw new Error('Invalid response from authentication server.');
      }

      // Role-based security check: Parent App only permits PARENT role
      if (result.user.role !== 'PARENT') {
        await clearStoredToken();
        throw new Error('Access denied: This mobile application is restricted to verified student parents only.');
      }

      await saveStoredToken(result.token);
      setUser(result.user);

      // Register FCM device token with backend
      registerPushTokenWithBackend().catch((err) => {
        console.warn('[AuthContext] Background push token registration note:', err.message);
      });

      return result.user;
    } finally {
      setIsAuthenticating(false);
    }
  }

  // 3. Parent Sign Out Action
  async function logout() {
    try {
      await unregisterPushTokenFromBackend();
    } catch (_) {}
    await clearStoredToken();
    setUser(null);
    setAuthError('');
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticating,
        authError,
        setAuthError,
        clearError,
        serverUrl,
        updateServerUrl,
        login,
        logout,
        isAuthenticated: Boolean(user && user.role === 'PARENT'),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
