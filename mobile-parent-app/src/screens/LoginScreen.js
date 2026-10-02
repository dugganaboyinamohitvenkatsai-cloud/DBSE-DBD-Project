import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Shield, Lock, Phone, Server, ChevronDown, ChevronUp, Sparkles } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/client';
import TouchButton from '../components/TouchButton';
import InputField from '../components/InputField';
import StateBanner from '../components/StateBanner';

/**
 * LoginScreen
 * Calm, Trustworthy Parent Entrance
 */
export default function LoginScreen() {
  const { login, isAuthenticating = false, authError, clearError, serverUrl, updateServerUrl } = useAuth();
  const activeServerUrl = (typeof serverUrl === 'string' && serverUrl.trim()) ? serverUrl : API_BASE_URL;

  const [identifier, setIdentifier] = useState('9876543210');
  const [password, setPassword] = useState('Parent@12345');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(activeServerUrl);
  const [serverSavedMsg, setServerSavedMsg] = useState(null);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      return;
    }
    clearError();
    await login(identifier.trim(), password);
  };

  const handleFillDemo = (phone, pass) => {
    setIdentifier(phone);
    setPassword(pass);
    clearError();
  };

  const handleSaveServer = async () => {
    if (!customServerUrl.trim()) return;
    const ok = await updateServerUrl(customServerUrl.trim());
    if (ok) {
      setServerSavedMsg('Server endpoint updated successfully.');
      setTimeout(() => setServerSavedMsg(null), 3000);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Shield size={32} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <Text style={styles.brandTitle}>SCHOOLBUS</Text>
          <Text style={styles.brandSubtitle}>Parent Safety & Tracking Portal</Text>
          <View style={styles.pillContainer}>
            <View style={styles.liveDot} />
            <Text style={styles.pillText}>Real-Time Child Transit Protection</Text>
          </View>
        </View>

        {/* Main Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Parent Sign In</Text>
          <Text style={styles.cardInstruction}>
            Enter your registered mobile phone number or email to access your child's live bus journey.
          </Text>

          {/* Error Banner */}
          {authError && (
            <StateBanner
              type="error"
              message={authError}
              dismissible
              onDismiss={clearError}
            />
          )}

          {/* Server updated message */}
          {serverSavedMsg && (
            <StateBanner
              type="info"
              message={serverSavedMsg}
            />
          )}

          {/* Identifier Input */}
          <InputField
            label="Mobile Number or Email"
            placeholder="e.g. 9876543210 or parent@school.com"
            value={identifier}
            onChangeText={(text) => {
              setIdentifier(text);
              if (authError) clearError();
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Phone size={18} color={COLORS.textSecondary} />}
          />

          {/* Password Input */}
          <InputField
            label="Password"
            placeholder="Enter your account password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (authError) clearError();
            }}
            secureTextEntry
            leftIcon={<Lock size={18} color={COLORS.textSecondary} />}
          />

          {/* Sign In Button */}
          <TouchButton
            title="Sign In to Parent Portal"
            onPress={handleLogin}
            loading={isAuthenticating}
            disabled={!identifier.trim() || !password}
            variant="primary"
            style={styles.loginButton}
          />

          {/* Quick Demo Pre-fills */}
          <View style={styles.demoSection}>
            <View style={styles.demoHeader}>
              <Sparkles size={13} color={COLORS.blue} />
              <Text style={styles.demoTitle}>TEST PARENT CREDENTIALS</Text>
            </View>
            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                style={styles.demoChip}
                onPress={() => handleFillDemo('9876543210', 'Parent@12345')}
                activeOpacity={0.7}
              >
                <Text style={styles.demoChipText}>Rahul's Parent (9876543210)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.demoChip}
                onPress={() => handleFillDemo('9687136172', 'Parent@12345')}
                activeOpacity={0.7}
              >
                <Text style={styles.demoChipText}>Mohit's Parent (9687136172)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Collapsible Server Endpoint Config */}
          <TouchableOpacity
            style={styles.serverToggle}
            onPress={() => setShowServerConfig(!showServerConfig)}
            activeOpacity={0.7}
          >
            <View style={styles.serverToggleLeft}>
              <Server size={14} color={COLORS.textSecondary} />
              <Text style={styles.serverToggleText}>
                Backend Server: {activeServerUrl.replace(/\/api\/?$/, '')}
              </Text>
            </View>
            {showServerConfig ? (
              <ChevronUp size={16} color={COLORS.textSecondary} />
            ) : (
              <ChevronDown size={16} color={COLORS.textSecondary} />
            )}
          </TouchableOpacity>

          {showServerConfig && (
            <View style={styles.serverConfigBox}>
              <InputField
                label="API Base URL (LAN Physical Phone)"
                placeholder="http://10.250.30.249:5000/api"
                value={customServerUrl}
                onChangeText={setCustomServerUrl}
                autoCapitalize="none"
              />
              <TouchButton
                title="Apply Server Endpoint"
                onPress={handleSaveServer}
                variant="outline"
                size="sm"
              />
            </View>
          )}
        </View>

        {/* Security & Reassurance Footer */}
        <View style={styles.footerNote}>
          <Shield size={14} color={COLORS.textMuted} />
          <Text style={styles.footerText}>
            Secured end-to-end child transit telemetry & automated push alerts.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.xxl,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.blue,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.blue,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.md,
  },
  cardHeader: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardInstruction: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.lg,
  },
  loginButton: {
    marginTop: SPACING.md,
  },
  demoSection: {
    marginTop: SPACING.xl,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: SPACING.xs,
  },
  demoTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 0.5,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  demoChip: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  demoChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  serverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  serverToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  serverToggleText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  serverConfigBox: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surfaceSubtle,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    flex: 1,
  },
});
