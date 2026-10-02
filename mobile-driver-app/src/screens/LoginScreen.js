import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bus,
  ShieldCheck,
  Eye,
  EyeOff,
  Server,
  AlertCircle,
  ArrowRight,
  Radio,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, setApiBaseUrl } from '../api/client';
import { InputField } from '../components/InputField';
import { TouchButton } from '../components/TouchButton';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

export function LoginScreen() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('Driver@12345');
  const [showPassword, setShowPassword] = useState(false);
  const [serverUrl, setServerUrl] = useState(API_BASE_URL);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!identifier.trim() || !password) {
      setError('Please provide driver email/phone and security credentials.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      setApiBaseUrl(serverUrl);
      await login(identifier, password);
    } catch (err) {
      setError(err.message || 'Failed to authenticate terminal. Verify network and server connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Branding */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Bus size={32} color="#FFFFFF" strokeWidth={2.2} />
            </View>

            <View style={styles.platformBadge}>
              <Radio size={12} color="#38BDF8" strokeWidth={2.5} />
              <Text style={styles.platformBadgeText}>FLEET OPERATIONS TERMINAL</Text>
            </View>

            <Text style={styles.title}>SCHOOLBUS</Text>
            <Text style={styles.subtitle}>Driver Operations & Safety Cockpit</Text>
            <Text style={styles.description}>
              Authorized vehicle console for live GPS telemetry, stop geofence evaluation, and student transport verification.
            </Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Driver Sign In</Text>
              <View style={styles.secureBadge}>
                <ShieldCheck size={14} color={COLORS.success} strokeWidth={2.5} />
                <Text style={styles.secureBadgeText}>SECURE TERMINAL</Text>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={18} color={COLORS.danger} strokeWidth={2.2} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <InputField
              label="Driver Email or Phone"
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Driver email or phone number"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <InputField
              label="Security Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••••••"
              secureTextEntry={!showPassword}
              rightIcon={
                showPassword ? (
                  <EyeOff size={18} color={COLORS.textSecondary} />
                ) : (
                  <Eye size={18} color={COLORS.textSecondary} />
                )
              }
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            <TouchButton
              title={loading ? 'VERIFYING CREDENTIALS...' : 'AUTHENTICATE TERMINAL'}
              icon={!loading ? <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} /> : null}
              iconPosition="right"
              onPress={handleLogin}
              loading={loading}
              variant="primary"
              style={styles.loginButton}
            />

            {/* Server Endpoint Config Accordion */}
            <TouchableOpacity
              style={styles.serverToggle}
              onPress={() => setShowServerConfig(!showServerConfig)}
              activeOpacity={0.7}
            >
              <Server size={14} color={COLORS.textSecondary} />
              <Text style={styles.serverToggleText}>
                {showServerConfig ? 'Hide Server Configuration' : 'Configure Server Endpoint IP'}
              </Text>
            </TouchableOpacity>

            {showServerConfig && (
              <View style={styles.serverConfigBox}>
                <InputField
                  label="API Server Base URL"
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="http://10.250.30.249:5000/api"
                  autoCapitalize="none"
                />
                <Text style={styles.serverHint}>
                  Defaulted to local network IP for physical phone Wi-Fi telemetry testing.
                </Text>
              </View>
            )}
          </View>

          {/* Footer note */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Encrypted token stored in device SecureStore • All telemetry logged in real time.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B132B', // High-end deep navy command theme
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORS.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    ...SHADOWS.md,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 10,
  },
  platformBadgeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.6,
    marginTop: 3,
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 22,
    ...SHADOWS.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.successLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
  },
  secureBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.successText,
    letterSpacing: 0.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    padding: 12,
    borderRadius: RADIUS.md,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: COLORS.dangerText,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  loginButton: {
    marginTop: 6,
    backgroundColor: COLORS.blue,
  },
  serverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 8,
  },
  serverToggleText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  serverConfigBox: {
    marginTop: 10,
    padding: 14,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  serverHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginTop: -8,
  },
  footer: {
    marginTop: 22,
    alignItems: 'center',
  },
  footerText: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
