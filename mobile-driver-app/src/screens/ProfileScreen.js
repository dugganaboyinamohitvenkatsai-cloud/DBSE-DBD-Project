import React from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  ShieldCheck,
  LogOut,
  Server,
  Mail,
  CheckCircle2,
  Lock,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../api/client';
import { TouchButton } from '../components/TouchButton';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

export function ProfileScreen() {
  const { user, logout } = useAuth();

  function handleLogout() {
    Alert.alert(
      'Sign Out Terminal',
      'Are you sure you want to log out of this vehicle cockpit terminal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>OPERATOR IDENTITY & TERMINAL</Text>
          <Text style={styles.subtitle}>Driver terminal clearance and device security</Text>
        </View>

        {/* Driver identity card */}
        <View style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              <User size={28} color="#FFFFFF" strokeWidth={2.2} />
            </View>
            <View style={styles.driverMeta}>
              <Text style={styles.driverName}>{user?.full_name || 'Driver Operator'}</Text>
              <View style={styles.roleTag}>
                <ShieldCheck size={12} color={COLORS.blue} strokeWidth={2.5} />
                <Text style={styles.roleTagText}>AUTHORIZED VEHICLE OPERATOR</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.labelCol}>
              <Mail size={13} color={COLORS.textSecondary} />
              <Text style={styles.label}>Email Identifier</Text>
            </View>
            <Text style={styles.value}>{user?.email || '—'}</Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.labelCol}>
              <ShieldCheck size={13} color={COLORS.textSecondary} />
              <Text style={styles.label}>Role Clearance</Text>
            </View>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>{user?.role || 'DRIVER'}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.labelCol}>
              <CheckCircle2 size={13} color={COLORS.successText} />
              <Text style={styles.label}>Account Status</Text>
            </View>
            <Text style={[styles.value, { color: COLORS.successText }]}>Active Operator</Text>
          </View>

          <View style={[styles.detailRow, styles.noBorder]}>
            <View style={styles.labelCol}>
              <Server size={13} color={COLORS.textSecondary} />
              <Text style={styles.label}>Target Endpoint</Text>
            </View>
            <Text style={[styles.value, { fontSize: 11, fontFamily: 'monospace' }]}>
              {API_BASE_URL}
            </Text>
          </View>
        </View>

        {/* Security & Sign Out Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Lock size={16} color={COLORS.textSecondary} strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Terminal Session Security</Text>
          </View>

          <Text style={styles.securityText}>
            Signing out will remove the cryptographic JWT token from your device's hardware SecureStore keystore. You will need to re-authenticate before dispatching another trip.
          </Text>

          <TouchButton
            title="SIGN OUT OF VEHICLE TERMINAL"
            icon={<LogOut size={16} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={handleLogout}
            variant="danger"
            style={{ marginTop: 16 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    ...SHADOWS.sm,
  },
  driverMeta: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 0.6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  labelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  value: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '800',
  },
  badgePill: {
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  badgePillText: {
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: '800',
  },
  securityText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});
