import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, WifiOff, X } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

export function StateBanner({
  isOffline,
  isStale,
  ageSeconds,
  type,
  message,
  dismissible = false,
  onDismiss,
}) {
  if (isOffline) {
    return (
      <View style={[styles.banner, styles.offlineBanner]}>
        <WifiOff size={16} color={COLORS.dangerText} strokeWidth={2.5} />
        <View style={styles.textCol}>
          <Text style={styles.offlineTitle}>NETWORK CONNECTION LOST</Text>
          <Text style={styles.offlineSub}>
            Displaying cached transit state • Auto-reconnecting in background...
          </Text>
        </View>
      </View>
    );
  }

  if (isStale) {
    return (
      <View style={[styles.banner, styles.staleBanner]}>
        <Clock size={16} color={COLORS.warningText} strokeWidth={2.5} />
        <View style={styles.textCol}>
          <Text style={styles.staleTitle}>GPS TELEMETRY STALE ({ageSeconds ?? 60}s ago)</Text>
          <Text style={styles.staleSub}>
            Vehicle position held • Waiting for fresh satellite lock from driver device.
          </Text>
        </View>
      </View>
    );
  }

  if (!message && !type) {
    return null;
  }

  const getBannerConfig = () => {
    switch (type) {
      case 'error':
        return {
          bg: COLORS.dangerLight,
          border: COLORS.dangerBorder,
          text: COLORS.dangerText,
          Icon: AlertCircle,
          defaultTitle: 'NOTICE',
        };
      case 'warning':
        return {
          bg: COLORS.warningLight,
          border: COLORS.warningBorder,
          text: COLORS.warningText,
          Icon: AlertTriangle,
          defaultTitle: 'TRANSIT ALERT',
        };
      case 'success':
        return {
          bg: COLORS.successLight,
          border: COLORS.successBorder,
          text: COLORS.successText,
          Icon: CheckCircle2,
          defaultTitle: 'SUCCESS',
        };
      case 'info':
      default:
        return {
          bg: COLORS.blueLight,
          border: COLORS.blueBorder,
          text: COLORS.blue,
          Icon: AlertCircle,
          defaultTitle: 'INFORMATION',
        };
    }
  };

  const config = getBannerConfig();
  const IconComponent = config.Icon;

  return (
    <View style={[styles.banner, { backgroundColor: config.bg, borderColor: config.border }]}>
      <IconComponent size={16} color={config.text} strokeWidth={2.5} />
      <View style={styles.textCol}>
        <Text style={[styles.messageText, { color: config.text }]}>
          {message || config.defaultTitle}
        </Text>
      </View>
      {dismissible && onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={15} color={config.text} strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default StateBanner;

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    marginBottom: 12,
    gap: 10,
    ...SHADOWS.sm,
  },
  offlineBanner: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.dangerBorder,
  },
  staleBanner: {
    backgroundColor: COLORS.warningLight,
    borderColor: COLORS.warningBorder,
  },
  textCol: {
    flex: 1,
  },
  offlineTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.dangerText,
    letterSpacing: 0.6,
  },
  offlineSub: {
    fontSize: 11,
    color: COLORS.dangerText,
    marginTop: 2,
    fontWeight: '500',
  },
  staleTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.warningText,
    letterSpacing: 0.6,
  },
  staleSub: {
    fontSize: 11,
    color: COLORS.warningText,
    marginTop: 2,
    fontWeight: '500',
  },
  messageText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
