import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  ShieldCheck,
  Bus,
  CheckCircle2,
  Clock,
  Navigation,
  MapPin,
  Radio,
} from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

export function SafetyStatusCard({ student, transport, child, statusData, onPressDetails }) {
  const resolvedStudent = student || child || statusData?.student;
  const resolvedTransport = transport || statusData?.transport || statusData;
  const status = resolvedTransport?.status;
  const studentStatus = resolvedTransport?.student_status;
  const pickupStop = resolvedTransport?.pickup_stop;
  const dropoffStop = resolvedTransport?.dropoff_stop;
  const isLive = resolvedTransport?.locationStatus === 'LIVE' || resolvedTransport?.trip?.status === 'IN_PROGRESS';

  const getCopy = () => {
    if (studentStatus === 'ON_BUS' || studentStatus === 'BOARDED') {
      return {
        title: 'Currently On Board Bus',
        subtitle: `En route to ${dropoffStop?.name || 'campus destination'}. Telemetry streaming live.`,
        theme: 'success',
        badge: 'ON BUS • SAFE TRANSIT',
        Icon: ShieldCheck,
      };
    }
    if (studentStatus === 'DROPPED_OFF') {
      return {
        title: 'Safely Arrived at Destination',
        subtitle: `Disembarked at ${dropoffStop?.name || 'scheduled stop'}. Trip concluded.`,
        theme: 'completed',
        badge: 'ARRIVED SAFELY',
        Icon: CheckCircle2,
      };
    }
    if (status === 'IN_PROGRESS' || status === 'LIVE' || status === 'BUS_ON_ROUTE') {
      return {
        title: 'Bus En Route to Pickup',
        subtitle: `Progressing along corridor towards ${pickupStop?.name || 'designated stop'}.`,
        theme: 'live',
        badge: 'BUS EN ROUTE',
        Icon: Navigation,
      };
    }
    if (status === 'TRIP_COMPLETED' || status === 'STOP_REACHED') {
      return {
        title: 'Transit Run Completed',
        subtitle: 'All milestones reached. Bus has concluded scheduled corridor run.',
        theme: 'completed',
        badge: 'RUN COMPLETED',
        Icon: CheckCircle2,
      };
    }
    return {
      title: 'Scheduled Departure (Standby)',
      subtitle: `Bus staged at depot. Live tracking will engage upon driver departure.`,
      theme: 'standby',
      badge: 'SCHEDULED STANDBY',
      Icon: Clock,
    };
  };

  const copy = getCopy();
  const IconComponent = copy.Icon;

  return (
    <View style={styles.card}>
      {/* Reassurance Header */}
      <View style={styles.headerRow}>
        <View style={styles.badgePill}>
          <IconComponent size={13} color={COLORS.blue} strokeWidth={2.5} />
          <Text style={styles.badgeText}>{copy.badge}</Text>
        </View>
        {isLive && (
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTagText}>LIVE</Text>
          </View>
        )}
      </View>

      <Text style={styles.studentGreeting}>
        {student?.name || 'Student'} • Class {student?.class || '—'}
      </Text>
      <Text style={styles.headline}>{copy.title}</Text>
      <Text style={styles.subheadline}>{copy.subtitle}</Text>

      {/* Pickup & Dropoff Designated Stops */}
      <View style={styles.stopsDeck}>
        <View style={styles.stopCol}>
          <View style={styles.stopLabelRow}>
            <MapPin size={12} color={COLORS.blue} strokeWidth={2.4} />
            <Text style={styles.stopLabel}>ASSIGNED PICKUP</Text>
          </View>
          <Text style={styles.stopName} numberOfLines={1}>
            {pickupStop?.name || 'Assigned Stop'}
          </Text>
          {pickupStop?.scheduled_time ? (
            <Text style={styles.stopTime}>Scheduled: {pickupStop.scheduled_time}</Text>
          ) : null}
        </View>

        <View style={styles.stopDivider} />

        <View style={styles.stopCol}>
          <View style={styles.stopLabelRow}>
            <MapPin size={12} color={COLORS.successText} strokeWidth={2.4} />
            <Text style={[styles.stopLabel, { color: COLORS.successText }]}>ASSIGNED DROPOFF</Text>
          </View>
          <Text style={styles.stopName} numberOfLines={1}>
            {dropoffStop?.name || 'Campus Gate'}
          </Text>
          {dropoffStop?.scheduled_time ? (
            <Text style={styles.stopTime}>Scheduled: {dropoffStop.scheduled_time}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 14,
    ...SHADOWS.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.blueLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.blue,
    letterSpacing: 0.6,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.successLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  liveTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.successText,
    letterSpacing: 0.5,
  },
  studentGreeting: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  headline: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  subheadline: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 16,
  },
  stopsDeck: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  stopCol: {
    flex: 1,
  },
  stopLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  stopLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 0.6,
  },
  stopName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  stopTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  stopDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
});

export default SafetyStatusCard;
