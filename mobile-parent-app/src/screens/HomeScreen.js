import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Shield, ChevronRight, Bell, Navigation, UserCheck } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useParentDashboard } from '../context/ParentDashboardContext';
import { useAuth } from '../context/AuthContext';
import ChildSwitcher from '../components/ChildSwitcher';
import SafetyStatusCard from '../components/SafetyStatusCard';
import TelemetryHUD from '../components/TelemetryHUD';
import NotificationCard from '../components/NotificationCard';
import StateBanner from '../components/StateBanner';

/**
 * HomeScreen
 * Child Safety Command Center
 */
export default function HomeScreen({ onNavigateTab, onOpenChildDetails }) {
  const { user } = useAuth();
  const {
    students,
    activeChild,
    activeChildId,
    activeStudentStatus,
    notifications,
    unreadCount,
    isLoading,
    isRefreshing,
    isOffline,
    error,
    refreshDashboard,
    switchChild,
    markNotificationAsRead,
  } = useParentDashboard();

  const currentTrip = activeStudentStatus?.trip || null;
  const currentBus = activeStudentStatus?.bus || null;
  const currentLocation = activeStudentStatus?.location || null;
  const isTripLive = currentTrip?.status === 'IN_PROGRESS';

  // Recent notifications (limit to 2 for home screen summary)
  const recentNotifications = notifications.slice(0, 2);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => refreshDashboard(true)}
          colors={[COLORS.blue]}
          tintColor={COLORS.blue}
        />
      }
    >
      {/* Top Welcome & Multi-child Switcher */}
      <View style={styles.topSection}>
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingSub}>WELCOME HOME</Text>
            <Text style={styles.greetingTitle}>
              {user?.name || user?.full_name || 'Parent Guardian'}
            </Text>
          </View>

          {/* Quick Alerts Pill */}
          <TouchableOpacity
            style={styles.alertsPill}
            onPress={() => onNavigateTab && onNavigateTab('notifications')}
            activeOpacity={0.7}
          >
            <Bell size={16} color={COLORS.primary} />
            {unreadCount > 0 && (
              <View style={styles.unreadCounter}>
                <Text style={styles.unreadCountText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Multi-child Switcher Bar */}
        {students && students.length > 0 && (
          <View style={styles.switcherContainer}>
            <ChildSwitcher
              childrenList={students}
              activeChildId={activeChildId}
              onSelectChild={switchChild}
            />
          </View>
        )}
      </View>

      {/* Network or Error Banner */}
      {isOffline && (
        <View style={styles.bannerMargin}>
          <StateBanner
            type="warning"
            message="Connection lost. Showing cached transit status. Reconnecting..."
          />
        </View>
      )}

      {error && !isOffline && (
        <View style={styles.bannerMargin}>
          <StateBanner
            type="error"
            message={error}
          />
        </View>
      )}

      {/* Hero Child Safety Reassurance Card */}
      <View style={styles.section}>
        <SafetyStatusCard
          child={activeChild}
          statusData={activeStudentStatus}
          onPressDetails={onOpenChildDetails}
        />
      </View>

      {/* Action Shortcut to Full Live Tracking */}
      {isTripLive && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.liveTrackingBanner}
            onPress={() => onNavigateTab && onNavigateTab('tracking')}
            activeOpacity={0.8}
          >
            <View style={styles.trackingBannerLeft}>
              <View style={styles.trackingIconBox}>
                <Navigation size={18} color="#FFFFFF" strokeWidth={2.5} />
              </View>
              <View>
                <Text style={styles.trackingBannerTitle}>Trip In Progress</Text>
                <Text style={styles.trackingBannerSub}>
                  Tap to view live route waypoints & stop progress
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Fleet & Telemetry HUD */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>BUS & TELEMETRY</Text>
          <TouchableOpacity
            onPress={onOpenChildDetails}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionActionText}>Child Details</Text>
          </TouchableOpacity>
        </View>
        <TelemetryHUD
          bus={currentBus}
          driver={currentBus}
          location={currentLocation}
          isLive={isTripLive}
        />
      </View>

      {/* Recent Alerts Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>RECENT SAFETY ALERTS</Text>
          <TouchableOpacity
            onPress={() => onNavigateTab && onNavigateTab('notifications')}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionActionText}>View All ({notifications.length})</Text>
          </TouchableOpacity>
        </View>

        {recentNotifications.length > 0 ? (
          recentNotifications.map((item) => (
            <NotificationCard
              key={item.id}
              notification={item}
              onPress={() => markNotificationAsRead(item.id)}
            />
          ))
        ) : (
          <View style={styles.emptyAlertsCard}>
            <Shield size={20} color={COLORS.textMuted} />
            <Text style={styles.emptyAlertsText}>
              No recent alerts. Everything is on schedule.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    paddingBottom: SPACING.xxxl,
  },
  topSection: {
    backgroundColor: COLORS.surface,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  greetingSub: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 0.8,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  alertsPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadCounter: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.danger,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadCountText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  switcherContainer: {
    marginTop: SPACING.xs,
  },
  bannerMargin: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  section: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.blue,
  },
  liveTrackingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.blue,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.md,
  },
  trackingBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  trackingIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  trackingBannerSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 1,
  },
  emptyAlertsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyAlertsText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
