import { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('auth_token');
    if (urlToken) {
      localStorage.setItem('accessToken', urlToken);
    }
    if (!localStorage.getItem('accessToken')) return setLoading(false);
    apiRequest('/auth/me').then(({ user: activeUser }) => setUser(activeUser)).catch(() => localStorage.removeItem('accessToken')).finally(() => setLoading(false));
  }, []);
  async function login(email, password) { const result = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); localStorage.setItem('accessToken', result.token); setUser(result.user); return result.user; }
  function logout() { localStorage.removeItem('accessToken'); setUser(null); }
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
