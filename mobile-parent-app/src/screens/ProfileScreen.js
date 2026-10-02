import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import {
  User,
  Phone,
  Mail,
  Shield,
  Bell,
  Server,
  LogOut,
  Users,
  CheckCircle,
  ExternalLink,
} from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useParentDashboard } from '../context/ParentDashboardContext';
import { API_BASE_URL } from '../api/client';
import TouchButton from '../components/TouchButton';

/**
 * ProfileScreen
 * Parent Identity, Push Notification Diagnostic, and Account Security
 */
export default function ProfileScreen() {
  const { user, logout, serverUrl } = useAuth();
  const { students } = useParentDashboard();

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of the SchoolBus Parent Portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>
            {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.name || user?.full_name || 'Parent Guardian'}</Text>
        <View style={styles.roleBadge}>
          <Shield size={12} color={COLORS.blue} />
          <Text style={styles.roleBadgeText}>VERIFIED PARENT / GUARDIAN</Text>
        </View>
      </View>

      {/* Account Details Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>ACCOUNT DETAILS</Text>

        <View style={styles.itemRow}>
          <Phone size={16} color={COLORS.textSecondary} />
          <View style={styles.itemTexts}>
            <Text style={styles.itemLabel}>Registered Mobile</Text>
            <Text style={styles.itemValue}>{user?.phone || 'Not Registered'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.itemRow}>
          <Mail size={16} color={COLORS.textSecondary} />
          <View style={styles.itemTexts}>
            <Text style={styles.itemLabel}>Email Address</Text>
            <Text style={styles.itemValue}>{user?.email || 'parent@schoolbus.local'}</Text>
          </View>
        </View>
      </View>

      {/* Linked Children Card */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionTitle}>LINKED STUDENTS</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{students.length}</Text>
          </View>
        </View>

        {students && students.length > 0 ? (
          students.map((child, idx) => (
            <View key={child.id || idx}>
              {idx > 0 && <View style={styles.divider} />}
              <View style={styles.childItemRow}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childAvatarInitial}>
                    {child.name ? child.name.charAt(0).toUpperCase() : 'S'}
                  </Text>
                </View>
                <View style={styles.childItemTexts}>
                  <Text style={styles.childName}>{child.name}</Text>
                  <Text style={styles.childSub}>
                    Class {child.class_grade || 'Standard'} • {child.route_name || 'Assigned Route'}
                  </Text>
                </View>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>Enrolled</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyChildrenText}>No linked students found.</Text>
        )}
      </View>

      {/* Push Notification Diagnostics */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionTitle}>PUSH NOTIFICATIONS (FCM)</Text>
          <View style={[styles.statusTag, styles.statusTagSuccess]}>
            <CheckCircle size={11} color={COLORS.successText} />
            <Text style={styles.statusTagText}>READY</Text>
          </View>
        </View>

        <View style={styles.itemRow}>
          <Bell size={16} color={COLORS.blue} />
          <View style={styles.itemTexts}>
            <Text style={styles.itemLabel}>Push Notification Pipeline</Text>
            <Text style={styles.itemValue}>Firebase Cloud Messaging (FCM)</Text>
            <Text style={styles.itemSubtext}>
              Automated push dispatched on transit start, geofence arrival, and destination reached.
            </Text>
          </View>
        </View>
      </View>

      {/* Server & Environment */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>SYSTEM & CONNECTIVITY</Text>

        <View style={styles.itemRow}>
          <Server size={16} color={COLORS.textSecondary} />
          <View style={styles.itemTexts}>
            <Text style={styles.itemLabel}>Backend API Endpoint</Text>
            <Text style={styles.itemValueMono}>{serverUrl || API_BASE_URL}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.itemRow}>
          <Shield size={16} color={COLORS.textSecondary} />
          <View style={styles.itemTexts}>
            <Text style={styles.itemLabel}>Application Version</Text>
            <Text style={styles.itemValue}>1.0.0 (Official Parent Release)</Text>
          </View>
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchButton
        title="Sign Out of Parent Portal"
        onPress={handleSignOut}
        variant="danger"
        style={styles.signOutBtn}
        icon={<LogOut size={16} color="#FFFFFF" />}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  header: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  avatarInitial: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.blueLight,
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.blue,
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
  },
  countBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  statusTagSuccess: {
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.successText,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingVertical: 2,
  },
  itemTexts: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  itemValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    marginTop: 2,
  },
  itemValueMono: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  itemSubtext: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 15,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.md,
  },
  childItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  childAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  childAvatarInitial: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  childItemTexts: {
    flex: 1,
  },
  childName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  childSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  activePill: {
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.successText,
  },
  emptyChildrenText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  signOutBtn: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
});
