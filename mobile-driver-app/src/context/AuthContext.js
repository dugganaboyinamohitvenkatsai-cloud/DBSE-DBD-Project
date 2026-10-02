import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginDriver, verifyCurrentSession } from '../api/authApi';
import { clearStoredToken, getStoredToken, saveStoredToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

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
          if (data.user.role !== 'DRIVER') {
            await clearStoredToken();
            setUser(null);
            setAuthError('Unauthorized: Driver credentials required.');
          } else {
            setUser(data.user);
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

  // 2. Driver Login Action
  async function login(identifier, password) {
    setAuthError('');
    const result = await loginDriver(identifier, password);

    if (!result?.token || !result?.user) {
      throw new Error('Invalid response from authentication server.');
    }

    // Role-based security check: Driver App only permits DRIVER role
    if (result.user.role !== 'DRIVER') {
      await clearStoredToken();
      throw new Error('Access denied: This mobile terminal is restricted to verified drivers only.');
    }

    await saveStoredToken(result.token);
    setUser(result.user);
    return result.user;
  }

  // 3. Driver Sign Out Action
  async function logout() {
    await clearStoredToken();
    setUser(null);
    setAuthError('');
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        setAuthError,
        login,
        logout,
        isAuthenticated: Boolean(user && user.role === 'DRIVER'),
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
