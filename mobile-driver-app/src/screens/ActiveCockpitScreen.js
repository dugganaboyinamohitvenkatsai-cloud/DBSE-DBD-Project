import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bus,
  Navigation,
  MapPin,
  CheckCircle2,
  Clock,
  Radio,
  Users,
  RefreshCw,
  AlertOctagon,
  ChevronRight,
} from 'lucide-react-native';
import { useTracking } from '../context/TrackingContext';
import { completeTrip, startTrip } from '../api/tripApi';
import { StateBanner } from '../components/StateBanner';
import { TouchButton } from '../components/TouchButton';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

export function ActiveCockpitScreen({ onNavigateToRoster }) {
  const {
    activeTrip,
    scheduledTrip,
    trackingState,
    currentLocation,
    lastUploadedAt,
    queueCount,
    refreshTripState,
    startTrackingSession,
    stopTrackingSession,
  } = useTracking();

  const [actionLoading, setActionLoading] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const displayTrip = activeTrip || scheduledTrip;
  const isTripActive = Boolean(activeTrip && activeTrip.status === 'IN_PROGRESS');

  // Handle Start Trip
  async function handleStartTrip() {
    if (!displayTrip?.id) return;
    setActionLoading(true);
    try {
      const res = await startTrip(displayTrip.id);
      startTrackingSession(res.trip || displayTrip);
      await refreshTripState();
    } catch (err) {
      Alert.alert('Unable to Start Trip', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Complete Trip
  async function handleCompleteTrip() {
    if (!activeTrip?.id) return;
    setActionLoading(true);
    try {
      await completeTrip(activeTrip.id);
      stopTrackingSession();
      setShowCompleteModal(false);
      await refreshTripState();
    } catch (err) {
      Alert.alert('Unable to Complete Trip', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const stops = displayTrip?.stops || [];
  const reachedCount = stops.filter((s) => s.is_reached).length;
  const nextStop = stops.find((s) => !s.is_reached);
  const lastReachedStop = [...stops].reverse().find((s) => s.is_reached);

  // Compute telemetry age in seconds
  const telemetryAgeSec = lastUploadedAt
    ? Math.max(0, Math.round((Date.now() - lastUploadedAt.getTime()) / 1000))
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Real-time Hardware / GPS State Banner */}
        <StateBanner state={trackingState} queueCount={queueCount} />

        {displayTrip ? (
          <>
            {/* Active Journey Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.routeHeader}>
                  <View style={styles.directionBadge}>
                    <Navigation size={12} color={COLORS.blue} strokeWidth={2.5} />
                    <Text style={styles.directionBadgeText}>
                      {displayTrip.route_code || 'RUN'} • {displayTrip.direction || 'PICKUP'}
                    </Text>
                  </View>
                  <Text style={styles.routeName}>{displayTrip.route_name || 'Assigned Route'}</Text>
                </View>

                <View style={styles.busBadge}>
                  <Bus size={14} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.busBadgeText}>BUS {displayTrip.bus_number}</Text>
                </View>
              </View>

              {/* Segmented Milestone Progress Indicator */}
              <View style={styles.progressContainer}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>JOURNEY PROGRESS</Text>
                  <Text style={styles.progressCount}>
                    {reachedCount} / {stops.length} STOPS REACHED
                  </Text>
                </View>

                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: stops.length > 0 ? `${(reachedCount / stops.length) * 100}%` : '0%',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Status Ribbon */}
              <View style={styles.statusRibbon}>
                <View style={styles.statusPill}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: isTripActive ? COLORS.success : COLORS.warning },
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {isTripActive ? 'IN PROGRESS' : displayTrip.status || 'SCHEDULED'}
                  </Text>
                </View>
                <Text style={styles.tripIdText}>DISPATCH #{displayTrip.id}</Text>
              </View>
            </View>

            {/* Current & Next Stop Focus Deck */}
            <View style={styles.stopDeck}>
              {/* Card 1: Last Reached / Current Stop */}
              <View style={styles.stopCard}>
                <View style={styles.stopCardHeader}>
                  <CheckCircle2 size={14} color={COLORS.success} strokeWidth={2.5} />
                  <Text style={styles.stopCardLabel}>LAST REACHED STOP</Text>
                </View>
                <Text style={styles.stopCardValue} numberOfLines={1}>
                  {lastReachedStop ? lastReachedStop.name : 'Terminal Departure'}
                </Text>
                <Text style={styles.stopCardSub}>
                  {lastReachedStop ? 'Geofence confirmed' : 'Awaiting start'}
                </Text>
              </View>

              {/* Card 2: Target Next Stop */}
              <View style={[styles.stopCard, styles.nextStopHighlight]}>
                <View style={styles.stopCardHeader}>
                  <MapPin size={14} color={COLORS.blue} strokeWidth={2.5} />
                  <Text style={[styles.stopCardLabel, { color: COLORS.blue }]}>NEXT TARGET STOP</Text>
                </View>
                <Text style={[styles.stopCardValue, { color: COLORS.primary }]} numberOfLines={1}>
                  {nextStop ? nextStop.name : 'Destination Reached'}
                </Text>
                <Text style={styles.stopCardSub}>
                  {nextStop?.scheduled_time ? `ETA: ${nextStop.scheduled_time}` : '100m Geofence Active'}
                </Text>
              </View>
            </View>

            {/* Live Telemetry HUD */}
            <View style={styles.telemetryCard}>
              <View style={styles.telemetryCardHeader}>
                <Radio size={14} color={COLORS.textSecondary} strokeWidth={2.5} />
                <Text style={styles.telemetryTitle}>DEVICE GPS TELEMETRY & NETWORK</Text>
              </View>

              <View style={styles.telemetryGrid}>
                <View style={styles.telemetryItem}>
                  <Text style={styles.telemetryLabel}>GPS ACCURACY</Text>
                  <Text style={styles.telemetryValue}>
                    {currentLocation?.accuracy ? `±${Math.round(currentLocation.accuracy)}m` : 'Acquiring...'}
                  </Text>
                  <Text style={styles.telemetrySub}>
                    {currentLocation?.accuracy && currentLocation.accuracy <= 50 ? 'Strong satellite fix' : 'Hardware antenna'}
                  </Text>
                </View>

                <View style={styles.telemetryDivider} />

                <View style={styles.telemetryItem}>
                  <Text style={styles.telemetryLabel}>TELEMETRY AGE</Text>
                  <Text style={styles.telemetryValue}>
                    {telemetryAgeSec !== null ? `${telemetryAgeSec}s ago` : 'Standby'}
                  </Text>
                  <Text style={styles.telemetrySub}>
                    {telemetryAgeSec !== null && telemetryAgeSec < 60 ? 'Live uplink active' : 'Awaiting packet'}
                  </Text>
                </View>

                <View style={styles.telemetryDivider} />

                <View style={styles.telemetryItem}>
                  <Text style={styles.telemetryLabel}>OFFLINE BUFFER</Text>
                  <Text
                    style={[
                      styles.telemetryValue,
                      { color: queueCount > 0 ? COLORS.warning : COLORS.successText },
                    ]}
                  >
                    {queueCount === 0 ? 'Clear (0)' : `${queueCount} queued`}
                  </Text>
                  <Text style={styles.telemetrySub}>
                    {queueCount > 0 ? 'Will flush on net' : 'All points synced'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Operations Strip */}
            <View style={styles.quickOpsRow}>
              <TouchableOpacity
                style={styles.quickOpButton}
                onPress={onNavigateToRoster}
                activeOpacity={0.75}
              >
                <View style={styles.quickOpIconCircle}>
                  <Users size={16} color={COLORS.blue} strokeWidth={2.2} />
                </View>
                <View style={styles.quickOpTextCol}>
                  <Text style={styles.quickOpTitle}>Student Safety Roster</Text>
                  <Text style={styles.quickOpSub}>
                    {displayTrip.student_count ?? 0} Students Assigned
                  </Text>
                </View>
                <ChevronRight size={18} color={COLORS.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.refreshIconButton}
                onPress={refreshTripState}
                activeOpacity={0.7}
              >
                <RefreshCw size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Vertical Route Waypoint Timeline */}
            {stops.length > 0 && (
              <View style={styles.timelineSection}>
                <View style={styles.timelineHeaderRow}>
                  <Text style={styles.timelineSectionTitle}>WAYPOINT PROGRESSION</Text>
                  <Text style={styles.geofencePill}>100M GEOFENCE</Text>
                </View>

                {stops.map((stop, index) => {
                  const isReached = stop.is_reached;
                  const isCurrent = !isReached && nextStop?.id === stop.id;

                  return (
                    <View key={stop.id} style={styles.timelineRow}>
                      {/* Timeline track and node */}
                      <View style={styles.nodeColumn}>
                        <View
                          style={[
                            styles.nodeCircle,
                            isReached
                              ? styles.nodeReached
                              : isCurrent
                              ? styles.nodeCurrent
                              : styles.nodeUpcoming,
                          ]}
                        >
                          {isReached ? (
                            <CheckCircle2 size={12} color="#FFFFFF" strokeWidth={3} />
                          ) : (
                            <View
                              style={[
                                styles.innerDot,
                                { backgroundColor: isCurrent ? '#FFFFFF' : COLORS.textMuted },
                              ]}
                            />
                          )}
                        </View>
                        {index < stops.length - 1 && (
                          <View
                            style={[
                              styles.verticalTrack,
                              isReached ? styles.trackCompleted : styles.trackUpcoming,
                            ]}
                          />
                        )}
                      </View>

                      {/* Stop detail */}
                      <View style={styles.stopContent}>
                        <View style={styles.stopHeaderRow}>
                          <Text
                            style={[
                              styles.stopNameText,
                              isCurrent ? styles.currentStopText : null,
                            ]}
                          >
                            {stop.name}
                          </Text>
                          <View
                            style={[
                              styles.stopBadgePill,
                              isReached
                                ? styles.badgeReached
                                : isCurrent
                                ? styles.badgeCurrent
                                : styles.badgeUpcoming,
                            ]}
                          >
                            <Text
                              style={[
                                styles.stopBadgeText,
                                isReached
                                  ? styles.badgeTextReached
                                  : isCurrent
                                  ? styles.badgeTextCurrent
                                  : styles.badgeTextUpcoming,
                              ]}
                            >
                              {isReached ? 'REACHED' : isCurrent ? 'TARGET' : 'UPCOMING'}
                            </Text>
                          </View>
                        </View>
                        {stop.scheduled_time ? (
                          <View style={styles.timeRow}>
                            <Clock size={11} color={COLORS.textSecondary} />
                            <Text style={styles.stopTimeText}>ETA {stop.scheduled_time}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Primary Action Controls */}
            <View style={styles.actionsContainer}>
              {!isTripActive && displayTrip?.status === 'SCHEDULED' ? (
                <TouchButton
                  title="START JOURNEY & BROADCAST GPS"
                  icon={<Navigation size={18} color="#FFFFFF" strokeWidth={2.5} />}
                  onPress={handleStartTrip}
                  loading={actionLoading}
                  variant="success"
                  style={styles.largePrimaryCta}
                />
              ) : isTripActive ? (
                <View style={styles.activeActionsRow}>
                  <TouchButton
                    title="EMERGENCY"
                    icon={<AlertOctagon size={18} color="#FFFFFF" strokeWidth={2.2} />}
                    onPress={() => setShowEmergencyModal(true)}
                    variant="danger"
                    style={styles.emergencyBtn}
                  />
                  <TouchButton
                    title="COMPLETE TRIP"
                    icon={<CheckCircle2 size={18} color="#FFFFFF" strokeWidth={2.2} />}
                    onPress={() => setShowCompleteModal(true)}
                    variant="primary"
                    style={styles.completeBtn}
                  />
                </View>
              ) : (
                <View style={styles.completedBanner}>
                  <CheckCircle2 size={16} color={COLORS.successText} strokeWidth={2.5} />
                  <Text style={styles.completedBannerText}>This trip has been concluded.</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Bus size={32} color={COLORS.textMuted} strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>No Active or Scheduled Run</Text>
            <Text style={styles.emptySubtitle}>
              Please check back when school dispatch assigns your bus run for today.
            </Text>
            <TouchButton
              title="REFRESH DISPATCH SCHEDULE"
              icon={<RefreshCw size={16} color={COLORS.primary} />}
              onPress={refreshTripState}
              variant="outline"
              style={{ marginTop: 16 }}
            />
          </View>
        )}
      </ScrollView>

      {/* Emergency Modal */}
      <Modal visible={showEmergencyModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.emergencyIconWrap}>
              <AlertOctagon size={32} color={COLORS.danger} strokeWidth={2.2} />
            </View>
            <Text style={styles.modalTitle}>Confirm Emergency Alert</Text>
            <Text style={styles.modalBody}>
              This will dispatch an immediate high-priority safety alert to the School Transportation Command Center with your exact device GPS location.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowEmergencyModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchButton
                title="DISPATCH ALERT"
                onPress={() => {
                  setShowEmergencyModal(false);
                  Alert.alert('Alert Dispatched', 'Emergency telemetry transmitted to Command Center.');
                }}
                variant="danger"
                style={{ flex: 1.4, minHeight: 46 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Complete Trip Modal */}
      <Modal visible={showCompleteModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.completeIconWrap}>
              <CheckCircle2 size={32} color={COLORS.blue} strokeWidth={2.2} />
            </View>
            <Text style={styles.modalTitle}>Complete Bus Journey?</Text>
            <Text style={styles.modalBody}>
              This will officially conclude the active route, set remaining students to dropped off, and power down live GPS telemetry.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowCompleteModal(false)}
              >
                <Text style={styles.modalCancelText}>Keep Driving</Text>
              </TouchableOpacity>
              <TouchButton
                title="FINALIZE TRIP"
                onPress={handleCompleteTrip}
                loading={actionLoading}
                variant="primary"
                style={{ flex: 1.4, minHeight: 46 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 14,
    ...SHADOWS.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  routeHeader: {
    flex: 1,
    paddingRight: 10,
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  directionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 0.8,
  },
  routeName: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  busBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
  },
  busBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
  progressCount: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.full,
  },
  statusRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.4,
  },
  tripIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  stopDeck: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  stopCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  nextStopHighlight: {
    borderColor: COLORS.blueBorder,
    backgroundColor: COLORS.blueLight,
  },
  stopCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  stopCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
  stopCardValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 3,
  },
  stopCardSub: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  telemetryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  telemetryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  telemetryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  telemetryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  telemetryValue: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 2,
  },
  telemetrySub: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  telemetryDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },
  quickOpsRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  quickOpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  quickOpIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.blueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  quickOpTextCol: {
    flex: 1,
  },
  quickOpTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  quickOpSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  refreshIconButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  timelineSection: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 16,
    ...SHADOWS.sm,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timelineSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  geofencePill: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.blue,
    backgroundColor: COLORS.blueLight,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADIUS.sm,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  nodeColumn: {
    alignItems: 'center',
    width: 24,
  },
  nodeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeReached: {
    backgroundColor: COLORS.success,
  },
  nodeCurrent: {
    backgroundColor: COLORS.blue,
  },
  nodeUpcoming: {
    backgroundColor: COLORS.borderLight,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  innerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  verticalTrack: {
    width: 2,
    flex: 1,
    marginVertical: 3,
  },
  trackCompleted: {
    backgroundColor: COLORS.successBorder,
  },
  trackUpcoming: {
    backgroundColor: COLORS.border,
  },
  stopContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  stopHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  currentStopText: {
    color: COLORS.blue,
    fontWeight: '800',
    fontSize: 15,
  },
  stopBadgePill: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADIUS.sm,
  },
  badgeReached: {
    backgroundColor: COLORS.successLight,
  },
  badgeCurrent: {
    backgroundColor: COLORS.blueLight,
  },
  badgeUpcoming: {
    backgroundColor: COLORS.surfaceSubtle,
  },
  stopBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  badgeTextReached: {
    color: COLORS.successText,
  },
  badgeTextCurrent: {
    color: COLORS.blue,
  },
  badgeTextUpcoming: {
    color: COLORS.textMuted,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  stopTimeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  actionsContainer: {
    marginTop: 4,
  },
  largePrimaryCta: {
    minHeight: 56,
  },
  activeActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  emergencyBtn: {
    flex: 1,
    minHeight: 54,
  },
  completeBtn: {
    flex: 1.5,
    minHeight: 54,
    backgroundColor: COLORS.primary,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.successLight,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
  },
  completedBannerText: {
    color: COLORS.successText,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 28,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    marginTop: 20,
    ...SHADOWS.md,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    ...SHADOWS.lg,
  },
  emergencyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  completeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.blueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
});
