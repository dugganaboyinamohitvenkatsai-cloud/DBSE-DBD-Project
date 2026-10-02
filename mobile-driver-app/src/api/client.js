import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'schoolbus_driver_token';

// In development:
// - Android Emulator: 10.0.2.2:5000
// - Physical device via adb reverse: localhost:5000
// - Physical device via Wi-Fi: replace with your laptop's local LAN IP (e.g. 10.250.30.249)
export let API_BASE_URL = 'http://10.250.30.249:5000/api';

export function setApiBaseUrl(newUrl) {
  if (newUrl && typeof newUrl === 'string') {
    API_BASE_URL = newUrl.replace(/\/+$/, '');
  }
}

export async function getStoredToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (err) {
    console.warn('[SecureStore] Failed to read token:', err.message);
    return null;
  }
}

export async function saveStoredToken(token) {
  try {
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (err) {
    console.warn('[SecureStore] Failed to write token:', err.message);
  }
}

export async function clearStoredToken() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (err) {
    console.warn('[SecureStore] Failed to clear token:', err.message);
  }
}

/**
 * Robust JSON API Request function
 */
export async function apiRequest(endpoint, options = {}) {
  const token = await getStoredToken();
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 12000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.message || `Request failed with status ${response.status}`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Please check your network and server connection.');
    }
    throw err;
  }
}
