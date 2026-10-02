import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Radio,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Clock,
  Compass,
  ShieldAlert,
  Navigation,
} from 'lucide-react-native';
import { TRACKING_STATES } from '../context/TrackingContext';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

const STATE_CONFIG = {
  [TRACKING_STATES.TRIP_NOT_ACTIVE]: {
    bg: '#F8FAFC',
    border: COLORS.border,
    text: COLORS.textSecondary,
    badgeBg: '#E2E8F0',
    dot: COLORS.textMuted,
    label: 'STANDBY • READY',
    sub: 'Vehicle terminal ready • Awaiting dispatch',
    Icon: Compass,
  },
  [TRACKING_STATES.READY_TO_START]: {
    bg: COLORS.blueLight,
    border: COLORS.blueBorder,
    text: '#1E40AF',
    badgeBg: '#DBEAFE',
    dot: COLORS.blue,
    label: 'READY TO DEPART',
    sub: 'Assigned route ready • Press Start Journey when underway',
    Icon: Navigation,
  },
  [TRACKING_STATES.STARTING_GPS]: {
    bg: COLORS.warningLight,
    border: COLORS.warningBorder,
    text: COLORS.warningText,
    badgeBg: '#FDE68A',
    dot: COLORS.warning,
    label: 'STARTING GPS',
    sub: 'Engaging device location provider...',
    Icon: Radio,
  },
  [TRACKING_STATES.GPS_SEARCHING]: {
    bg: COLORS.warningLight,
    border: COLORS.warningBorder,
    text: COLORS.warningText,
    badgeBg: '#FDE68A',
    dot: COLORS.warning,
    label: 'GPS SEARCHING',
    sub: 'Acquiring satellite fix from device antenna...',
    Icon: Radio,
  },
  [TRACKING_STATES.GPS_CONNECTED]: {
    bg: COLORS.successLight,
    border: COLORS.successBorder,
    text: COLORS.successText,
    badgeBg: '#BBF7D0',
    dot: COLORS.success,
    label: 'GPS CONNECTED',
    sub: 'High-accuracy satellite telemetry active',
    Icon: CheckCircle2,
  },
  [TRACKING_STATES.TRACKING_LIVE]: {
    bg: COLORS.successLight,
    border: COLORS.successBorder,
    text: COLORS.successText,
    badgeBg: '#BBF7D0',
    dot: COLORS.success,
    label: 'LIVE TELEMETRY ACTIVE',
    sub: 'Direct device GPS broadcasting to school safety portal',
    Icon: Radio,
  },
  [TRACKING_STATES.STOP_APPROACHING]: {
    bg: COLORS.blueLight,
    border: COLORS.blueBorder,
    text: '#1E3A8A',
    badgeBg: '#DBEAFE',
    dot: COLORS.blue,
    label: 'STOP APPROACHING',
    sub: 'Vehicle approaching scheduled passenger waypoint',
    Icon: Navigation,
  },
  [TRACKING_STATES.STOP_REACHED]: {
    bg: '#D1FAE5',
    border: '#6EE7B7',
    text: '#065F46',
    badgeBg: '#A7F3D0',
    dot: '#059669',
    label: 'STOP REACHED',
    sub: 'Within 100m geofence radius • Boarding verification open',
    Icon: CheckCircle2,
  },
  [TRACKING_STATES.NETWORK_OFFLINE]: {
    bg: '#FFEDD5',
    border: '#FED7AA',
    text: '#9A3412',
    badgeBg: '#FFD8A8',
    dot: '#EA580C',
    label: 'NETWORK OFFLINE',
    sub: 'Buffering location points locally in hardware queue',
    Icon: WifiOff,
  },
  [TRACKING_STATES.LOCATION_STALE]: {
    bg: COLORS.dangerLight,
    border: COLORS.dangerBorder,
    text: COLORS.dangerText,
    badgeBg: '#FECACA',
    dot: COLORS.danger,
    label: 'LOCATION STALE',
    sub: 'No GPS telemetry received for >60s • Check clear sky view',
    Icon: Clock,
  },
  [TRACKING_STATES.LOW_GPS_ACCURACY]: {
    bg: COLORS.warningLight,
    border: COLORS.warningBorder,
    text: COLORS.warningText,
    badgeBg: '#FDE68A',
    dot: COLORS.warning,
    label: 'GPS ACCURACY LOW',
    sub: 'Precision >80m • Coordinates held to protect geofence fidelity',
    Icon: AlertTriangle,
  },
  [TRACKING_STATES.LOCATION_PERMISSION_REQUIRED]: {
    bg: COLORS.dangerLight,
    border: COLORS.dangerBorder,
    text: COLORS.dangerText,
    badgeBg: '#FECACA',
    dot: COLORS.danger,
    label: 'LOCATION PERMISSION REQUIRED',
    sub: 'Grant "Precise Location While in Use" in Android Settings',
    Icon: ShieldAlert,
  },
  [TRACKING_STATES.TRIP_COMPLETED]: {
    bg: '#F8FAFC',
    border: COLORS.border,
    text: COLORS.textSecondary,
    badgeBg: '#E2E8F0',
    dot: COLORS.textMuted,
    label: 'JOURNEY CONCLUDED',
    sub: 'All milestones completed • Live broadcast concluded',
    Icon: CheckCircle2,
  },
};

export function StateBanner({ state, queueCount = 0 }) {
  const config = STATE_CONFIG[state] || STATE_CONFIG[TRACKING_STATES.TRIP_NOT_ACTIVE];
  const IconComponent = config.Icon || Radio;

  return (
    <View style={[styles.container, { backgroundColor: config.bg, borderColor: config.border }]}>
      <View style={styles.topRow}>
        <View style={styles.badgeWrapper}>
          <View style={[styles.iconPill, { backgroundColor: config.badgeBg }]}>
            <IconComponent size={14} color={config.dot} strokeWidth={2.5} />
          </View>
          <Text style={[styles.stateLabel, { color: config.text }]}>{config.label}</Text>
        </View>
        {queueCount > 0 && (
          <View style={styles.queuePill}>
            <Text style={styles.queueText}>{queueCount} QUEUED</Text>
          </View>
        )}
      </View>
      <Text style={[styles.subText, { color: config.text }]}>{config.sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  subText: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    paddingLeft: 32,
  },
  queuePill: {
    backgroundColor: '#EA580C',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
  },
  queueText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
