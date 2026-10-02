import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Bell, CheckCheck, Filter, ShieldCheck } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import { useParentDashboard } from '../context/ParentDashboardContext';
import NotificationCard from '../components/NotificationCard';

/**
 * NotificationsScreen
 * Safety Alert Center with Read State & Filtering
 */
export default function NotificationsScreen() {
  const {
    notifications,
    unreadCount,
    isRefreshing,
    refreshDashboard,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useParentDashboard();

  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'STOPS'

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'UNREAD') {
      return notifications.filter((n) => !n.is_read);
    }
    if (activeFilter === 'STOPS') {
      return notifications.filter(
        (n) => (n.event_type || n.type) === 'STOP_REACHED' || (n.event_type || n.type) === 'STOP_ARRIVED'
      );
    }
    return notifications;
  }, [notifications, activeFilter]);

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Safety Alerts</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0
              ? `${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}`
              : 'All notifications caught up'}
          </Text>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={markAllNotificationsAsRead}
            activeOpacity={0.7}
          >
            <CheckCheck size={14} color={COLORS.blue} />
            <Text style={styles.markAllText}>Mark Read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'ALL' && styles.filterChipActive]}
          onPress={() => setActiveFilter('ALL')}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.filterText, activeFilter === 'ALL' && styles.filterTextActive]}
          >
            All ({notifications.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'UNREAD' && styles.filterChipActive]}
          onPress={() => setActiveFilter('UNREAD')}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.filterText, activeFilter === 'UNREAD' && styles.filterTextActive]}
          >
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterChip, activeFilter === 'STOPS' && styles.filterChipActive]}
          onPress={() => setActiveFilter('STOPS')}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.filterText, activeFilter === 'STOPS' && styles.filterTextActive]}
          >
            Stops
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
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
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => (
            <NotificationCard
              key={notif.id}
              notification={notif}
              onPress={() => markNotificationAsRead(notif.id)}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <ShieldCheck size={32} color={COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Alerts in this View</Text>
            <Text style={styles.emptyDesc}>
              {activeFilter === 'UNREAD'
                ? 'All alerts have been reviewed. New transit events will appear here in real-time.'
                : 'No notification records found.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.blueLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.blue,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
