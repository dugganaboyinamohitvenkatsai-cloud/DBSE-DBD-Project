import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Navigation, CheckCircle2, AlertTriangle, Bell, Clock, ShieldAlert } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

/**
 * NotificationCard
 * Child safety event alert card
 */
export default function NotificationCard({
  notification,
  onPress,
}) {
  const {
    id,
    title = 'Safety Notification',
    message = '',
    event_type = 'GENERAL',
    type = 'GENERAL',
    is_read = false,
    created_at,
  } = notification;

  const resolvedType = event_type || type || 'GENERAL';

  // Config by event type
  const getTypeConfig = () => {
    switch (resolvedType) {
      case 'STOP_REACHED':
      case 'STOP_ARRIVED':
        return {
          icon: MapPin,
          color: COLORS.success,
          bg: COLORS.successLight,
          label: 'STOP REACHED',
        };
      case 'TRIP_STARTED':
      case 'TRANSIT_START':
        return {
          icon: Navigation,
          color: COLORS.blue,
          bg: COLORS.blueLight,
          label: 'TRIP STARTED',
        };
      case 'TRIP_COMPLETED':
      case 'DESTINATION_REACHED':
        return {
          icon: CheckCircle2,
          color: COLORS.primary,
          bg: COLORS.surfaceHighlight,
          label: 'TRIP COMPLETED',
        };
      case 'DELAY_ALERT':
      case 'TRAFFIC_DELAY':
        return {
          icon: AlertTriangle,
          color: COLORS.warning,
          bg: COLORS.warningLight,
          label: 'TRANSIT DELAY',
        };
      case 'EMERGENCY':
      case 'SAFETY_ALERT':
        return {
          icon: ShieldAlert,
          color: COLORS.danger,
          bg: COLORS.dangerLight,
          label: 'SAFETY ALERT',
        };
      default:
        return {
          icon: Bell,
          color: COLORS.primary,
          bg: COLORS.surfaceSubtle,
          label: 'UPDATE',
        };
    }
  };

  const config = getTypeConfig();
  const IconComponent = config.icon;

  // Format time
  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' • ' +
        date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        !is_read && styles.cardUnread,
      ]}
      onPress={() => onPress && onPress(notification)}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        {/* Type Icon Badge */}
        <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
          <IconComponent size={18} color={config.color} strokeWidth={2.2} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={[styles.typeBadge, { backgroundColor: config.bg }]}>
              <Text style={[styles.typeText, { color: config.color }]}>
                {config.label}
              </Text>
            </View>

            {!is_read && <View style={styles.unreadDot} />}
          </View>

          <Text style={[styles.title, !is_read && styles.titleUnread]} numberOfLines={2}>
            {title}
          </Text>

          {message ? (
            <Text style={styles.message} numberOfLines={3}>
              {message}
            </Text>
          ) : null}

          {created_at ? (
            <View style={styles.timeRow}>
              <Clock size={11} color={COLORS.textMuted} />
              <Text style={styles.timeText}>{formatTime(created_at)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  cardUnread: {
    borderColor: COLORS.blueBorder,
    backgroundColor: '#FAF5FF' === '#FAF5FF' ? '#FBFCFE' : COLORS.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  typeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.blue,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 19,
  },
  titleUnread: {
    fontWeight: '700',
    color: COLORS.text,
  },
  message: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.sm,
  },
  timeText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
});
