import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Bus, User, Phone, Gauge, Compass, Satellite, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

/**
 * TelemetryHUD
 * Operational Telemetry & Driver Contacts HUD
 */
export default function TelemetryHUD({
  bus = null,
  driver = null,
  location = null,
  isLive = false,
}) {
  const handleCallDriver = () => {
    const phone = driver?.phone || driver?.contact_number || bus?.driver_phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {});
    }
  };

  const regNumber = bus?.registration_number || bus?.plate_number || 'Vehicle Pending';
  const driverName = driver?.name || driver?.full_name || bus?.driver_name || 'Driver Assigned';
  const driverPhone = driver?.phone || driver?.contact_number || bus?.driver_phone;
  const busModel = bus?.model || bus?.capacity ? `${bus?.capacity || ''} Seater` : 'School Transport';

  // Format telemetry
  const lat = location?.latitude != null ? Number(location.latitude).toFixed(5) : null;
  const lng = location?.longitude != null ? Number(location.longitude).toFixed(5) : null;
  const speed = location?.speed != null ? Math.round(Number(location.speed)) : 0;
  const heading = location?.heading != null ? Math.round(Number(location.heading)) : null;
  const accuracy = location?.accuracy != null ? Math.round(Number(location.accuracy)) : null;
  const ageSeconds = location?.age_seconds != null ? Math.round(Number(location.age_seconds)) : null;

  const isStale = ageSeconds !== null && ageSeconds > 30;

  return (
    <View style={styles.card}>
      {/* Top Row: Vehicle & Driver info */}
      <View style={styles.topRow}>
        <View style={styles.vehicleBlock}>
          <View style={styles.busIconBox}>
            <Bus size={20} color={COLORS.primary} strokeWidth={2.2} />
          </View>
          <View style={styles.vehicleTexts}>
            <Text style={styles.regNumber}>{regNumber}</Text>
            <Text style={styles.busModel}>{busModel}</Text>
          </View>
        </View>

        {driverPhone && (
          <TouchableOpacity
            style={styles.callButton}
            onPress={handleCallDriver}
            activeOpacity={0.8}
            accessibilityLabel={`Call Driver ${driverName}`}
          >
            <Phone size={15} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Driver details line */}
      <View style={styles.driverLine}>
        <User size={13} color={COLORS.textSecondary} />
        <Text style={styles.driverLabel}>Driver:</Text>
        <Text style={styles.driverValue}>{driverName}</Text>
        {driverPhone && <Text style={styles.driverPhone}>• {driverPhone}</Text>}
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Telemetry Metrics Row */}
      {isLive && lat && lng ? (
        <View style={styles.telemetryGrid}>
          {/* Speed */}
          <View style={styles.telemetryCell}>
            <View style={styles.cellHeader}>
              <Gauge size={13} color={COLORS.blue} />
              <Text style={styles.cellTitle}>SPEED</Text>
            </View>
            <Text style={styles.cellValue}>{speed} <Text style={styles.cellUnit}>km/h</Text></Text>
          </View>

          {/* GPS Accuracy */}
          <View style={styles.telemetryCell}>
            <View style={styles.cellHeader}>
              <Satellite size={13} color={COLORS.success} />
              <Text style={styles.cellTitle}>GPS ACCURACY</Text>
            </View>
            <Text style={styles.cellValue}>
              {accuracy ? `±${accuracy}` : 'High'} <Text style={styles.cellUnit}>{accuracy ? 'm' : 'Fix'}</Text>
            </Text>
          </View>

          {/* Heading */}
          <View style={styles.telemetryCell}>
            <View style={styles.cellHeader}>
              <Compass size={13} color={COLORS.textSecondary} />
              <Text style={styles.cellTitle}>HEADING</Text>
            </View>
            <Text style={styles.cellValue}>
              {heading !== null ? `${heading}°` : 'N/A'}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.offlineTelemetryRow}>
          <ShieldCheck size={16} color={COLORS.success} />
          <Text style={styles.offlineTelemetryText}>
            Trip telemetry will stream automatically when the driver initiates transit.
          </Text>
        </View>
      )}

      {/* Bottom GPS Coordinates & Freshness */}
      {lat && lng && (
        <View style={styles.footerRow}>
          <Text style={styles.coordsText}>
            GPS: {lat}, {lng}
          </Text>
          <View style={styles.freshnessBadge}>
            {isStale ? (
              <>
                <AlertCircle size={11} color={COLORS.warningText} />
                <Text style={styles.staleText}>{ageSeconds}s ago</Text>
              </>
            ) : (
              <>
                <View style={styles.livePulse} />
                <Text style={styles.freshText}>
                  {ageSeconds !== null ? `${ageSeconds}s ago` : 'Real-time'}
                </Text>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  busIconBox: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleTexts: {
    justifyContent: 'center',
  },
  regNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  busModel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    ...SHADOWS.sm,
  },
  callButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  driverLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: SPACING.sm,
    paddingLeft: 2,
  },
  driverLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  driverValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  driverPhone: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.md,
  },
  telemetryGrid: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  telemetryCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  cellTitle: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  cellValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  cellUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  offlineTelemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  offlineTelemetryText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  coordsText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: COLORS.textMuted,
  },
  freshnessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  livePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  freshText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.successText,
  },
  staleText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.warningText,
  },
});
