import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import {
  ArrowLeft,
  User,
  GraduationCap,
  Route,
  MapPin,
  Bus,
  Phone,
  ShieldCheck,
  Calendar,
} from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useParentDashboard } from '../context/ParentDashboardContext';
import TouchButton from '../components/TouchButton';

/**
 * ChildDetailsScreen
 * Student Transit Manifest & Assignment Details
 */
export default function ChildDetailsScreen({ onBack }) {
  const { activeChild, activeStudentStatus } = useParentDashboard();

  const student = activeStudentStatus?.student || activeChild || {};
  const bus = activeStudentStatus?.bus || {};

  const handleCallDriver = () => {
    const phone = bus?.driver_phone || student?.driver_phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() => {});
    }
  };

  const handleCallEmergency = () => {
    Linking.openURL('tel:100').catch(() => {});
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Student Profile</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Student Identity Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {student?.name ? student.name.charAt(0).toUpperCase() : 'S'}
            </Text>
          </View>
          <Text style={styles.studentName}>{student?.name || 'Student'}</Text>
          <Text style={styles.admissionText}>
            Admission #{student?.admission_number || 'N/A'}
          </Text>

          <View style={styles.classBadge}>
            <GraduationCap size={13} color={COLORS.blue} />
            <Text style={styles.classBadgeText}>
              Class {student?.class_grade || 'Standard'} • Section {student?.section || 'A'}
            </Text>
          </View>
        </View>

        {/* Transportation Assignment */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Route size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>TRANSIT ASSIGNMENT</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Assigned Route</Text>
            <Text style={styles.detailValueBold}>
              {student?.route_name || 'Standard School Route'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.stopInfoBlock}>
              <View style={styles.stopLabelRow}>
                <MapPin size={13} color={COLORS.blue} />
                <Text style={styles.stopTypeLabel}>Pickup Stop</Text>
              </View>
              <Text style={styles.stopNameText}>
                {student?.pickup_stop_name || 'Designated Home Stop'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.stopInfoBlock}>
              <View style={styles.stopLabelRow}>
                <MapPin size={13} color={COLORS.primary} />
                <Text style={styles.stopTypeLabel}>Dropoff Stop</Text>
              </View>
              <Text style={styles.stopNameText}>
                {student?.dropoff_stop_name || 'Designated School Stop'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Designated Seat</Text>
            <View style={student?.seat_number ? styles.seatBadgeActive : styles.seatBadgeInactive}>
              <Text style={student?.seat_number ? styles.seatBadgeActiveText : styles.seatBadgeInactiveText}>
                {student?.seat_number ? `Seat #${student.seat_number}` : 'Open Seating / Unassigned'}
              </Text>
            </View>
          </View>
        </View>

        {/* Vehicle & Assigned Driver */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Bus size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>ASSIGNED BUS & DRIVER</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Vehicle Registration</Text>
            <Text style={styles.detailValueBold}>
              {bus?.registration_number || student?.bus_registration_number || 'Vehicle Pending'}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Driver Name</Text>
            <Text style={styles.detailValue}>
              {bus?.driver_name || student?.driver_name || 'Assigned Driver'}
            </Text>
          </View>

          {(bus?.driver_phone || student?.driver_phone) && (
            <>
              <View style={styles.divider} />
              <View style={styles.driverCallRow}>
                <View>
                  <Text style={styles.detailLabel}>Driver Contact</Text>
                  <Text style={styles.detailValue}>
                    {bus?.driver_phone || student?.driver_phone}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.callSmallBtn}
                  onPress={handleCallDriver}
                  activeOpacity={0.8}
                >
                  <Phone size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.callSmallBtnText}>Call Driver</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Safety & Protocol Notice */}
        <View style={styles.safetyNoticeCard}>
          <ShieldCheck size={20} color={COLORS.success} />
          <View style={styles.noticeTextWrapper}>
            <Text style={styles.noticeTitle}>Child Safety Guarantee</Text>
            <Text style={styles.noticeDesc}>
              Location telemetry is monitored continuously while the trip is in progress. Any route delays or unscheduled stops generate automated notifications.
            </Text>
          </View>
        </View>

        {/* Action Button */}
        <TouchButton
          title="Return to Dashboard"
          onPress={onBack}
          variant="outline"
          style={styles.returnBtn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  topBarSpacer: {
    width: 36,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  studentName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  admissionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  classBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.blueLight,
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginTop: SPACING.md,
  },
  classBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.blue,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '500',
  },
  detailValueBold: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.sm,
  },
  seatBadgeActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  seatBadgeActiveText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  seatBadgeInactive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  seatBadgeInactiveText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  stopInfoBlock: {
    flex: 1,
  },
  stopLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  stopTypeLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  stopNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  driverCallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.success,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  callSmallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  safetyNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
  },
  noticeTextWrapper: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.successText,
    marginBottom: 2,
  },
  noticeDesc: {
    fontSize: 12,
    color: COLORS.successText,
    lineHeight: 16,
  },
  returnBtn: {
    marginBottom: SPACING.md,
  },
});
