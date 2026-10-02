import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  Navigation,
  Route,
  MapPin,
  RefreshCw,
  Bus,
  Phone,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Radio,
  AlertTriangle,
} from 'lucide-react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { useParentDashboard } from '../context/ParentDashboardContext';
import StopTimeline from '../components/StopTimeline';
import TelemetryHUD from '../components/TelemetryHUD';
import StateBanner from '../components/StateBanner';
import LiveTrackingMapView from '../components/LiveTrackingMapView';
import { fetchTripJourney } from '../api/trackingApi';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Production-Quality LiveTrackingScreen
 * Real OpenStreetMap road tiles, real GPS telemetry, custom school bus marker,
 * road-following polyline, and live journey status overlay.
 */
export default function LiveTrackingScreen() {
  const {
    activeChild,
    activeStudentStatus,
    isRefreshing,
    isOffline,
    refreshDashboard,
  } = useParentDashboard();

  const [journeyStops, setJourneyStops] = useState([]);
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [showFullTimeline, setShowFullTimeline] = useState(false);

  const currentTrip = activeStudentStatus?.trip || null;
  const currentBus = activeStudentStatus?.bus || null;
  const currentLocation = activeStudentStatus?.location || null;
  const progress = activeStudentStatus?.progress || null;
  const isTripLive = currentTrip?.status === 'IN_PROGRESS';

  // Load detailed journey stops and road geometry
  useEffect(() => {
    let isMounted = true;
    const loadJourney = async () => {
      if (currentTrip?.id) {
        setLoadingJourney(true);
        try {
          const res = await fetchTripJourney(currentTrip.id);
          if (isMounted) {
            if (res.success && res.data?.stops) {
              setJourneyStops(res.data.stops);
            }
            const geom = res.data?.route_geometry || res.journey?.route_geometry || null;
            if (geom) {
              setRouteGeometry(geom);
            }
          }
        } catch (err) {
          console.warn('[LiveTracking] Could not load detailed trip journey:', err.message);
        } finally {
          if (isMounted) setLoadingJourney(false);
        }
      } else {
        if (progress?.stops) {
          setJourneyStops(progress.stops);
        } else {
          setJourneyStops([]);
        }
        if (progress?.route_geometry) {
          setRouteGeometry(progress.route_geometry);
        }
      }
    };

    loadJourney();
    return () => {
      isMounted = false;
    };
  }, [currentTrip?.id, progress?.stops, progress?.route_geometry]);

  // Stops to show: prefer journeyStops, fallback to progress.stops
  const stopsToDisplay = journeyStops.length > 0 ? journeyStops : (progress?.stops || []);
  const totalStops = stopsToDisplay.length || progress?.total_stops || 0;
  const completedStops =
    progress?.completed_stops ||
    stopsToDisplay.filter((s) => s.status === 'COMPLETED' || s.isReached || s.completed_at).length;

  // Derive Last Reached Stop and Next Stop
  const { lastReachedStop, nextStop } = useMemo(() => {
    let lastReached = null;
    let next = null;

    for (let i = 0; i < stopsToDisplay.length; i++) {
      const s = stopsToDisplay[i];
      const isReached = s.isReached || s.status === 'COMPLETED';
      if (isReached) {
        lastReached = s;
      } else if (!next) {
        next = s;
      }
    }

    return { lastReachedStop: lastReached, nextStop: next };
  }, [stopsToDisplay]);

  // Derive human-readable trip status text
  const busStatusText = useMemo(() => {
    if (isTripLive) return 'On the way • Live Transit';
    if (currentTrip?.status === 'STARTED') return 'Departing Terminal';
    if (currentTrip?.status === 'SCHEDULED') return 'Scheduled Departure';
    if (currentTrip?.status === 'COMPLETED') return 'Trip Completed';
    if (currentTrip?.status === 'CANCELLED') return 'Trip Cancelled';
    return 'Awaiting Assigned Journey';
  }, [isTripLive, currentTrip?.status]);

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
      {/* ── Offline Banner ── */}
      {isOffline && (
        <View style={styles.offlineBox}>
          <StateBanner
            type="warning"
            message="Operating offline. Displaying cached stop coordinates."
          />
        </View>
      )}

      {/* ── Real Geographic Live Map Section ── */}
      <View style={styles.mapCard}>
        <View style={styles.mapHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Bus size={15} color={COLORS.primary} />
            <Text style={styles.mapTitle}>
              {currentBus?.bus_number ? `Bus ${currentBus.bus_number}` : 'Fleet Transit Map'}
            </Text>
            {activeChild?.seat_number && (
              <View style={styles.seatPill}>
                <Text style={styles.seatPillText}>Seat {activeChild.seat_number}</Text>
              </View>
            )}
          </View>

          <View style={[styles.statusBadge, isTripLive ? styles.badgeLive : styles.badgeInactive]}>
            <View style={[styles.statusDot, isTripLive ? styles.dotLive : styles.dotInactive]} />
            <Text style={[styles.statusBadgeText, isTripLive ? styles.textLive : styles.textInactive]}>
              {isTripLive ? 'LIVE' : currentTrip?.status || 'IDLE'}
            </Text>
          </View>
        </View>

        {/* Real Interactive Leaflet + OpenStreetMap Map */}
        <View style={styles.mapWrapper}>
          <LiveTrackingMapView
            stops={stopsToDisplay}
            location={currentLocation}
            busNumber={currentBus?.bus_number || 'School Bus'}
            routeGeometry={routeGeometry}
            isLive={isTripLive}
          />
        </View>
      </View>

      {/* ── Polished Live Journey Bottom Information Panel ── */}
      <View style={styles.journeyPanel}>
        <View style={styles.panelHeaderRow}>
          <View>
            <Text style={styles.panelEyebrow}>LIVE JOURNEY</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={styles.panelStatusText}>🚌 {busStatusText}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => refreshDashboard(true)}
            activeOpacity={0.7}
            style={styles.syncBtn}
          >
            <RefreshCw size={13} color={COLORS.blue} />
            <Text style={styles.syncBtnText}>Sync</Text>
          </TouchableOpacity>
        </View>

        {/* Milestone Cards: Last Reached vs Next Stop */}
        <View style={styles.milestoneGrid}>
          {/* Last reached stop */}
          <View style={styles.milestoneCard}>
            <View style={styles.milestoneHeader}>
              <View style={[styles.milestoneDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.milestoneLabel}>LAST REACHED</Text>
            </View>
            <Text style={styles.milestoneName} numberOfLines={1}>
              {lastReachedStop ? lastReachedStop.name : 'Terminal Origin'}
            </Text>
            <Text style={styles.milestoneSub}>
              {lastReachedStop?.reached_at
                ? `Reached at ${new Date(lastReachedStop.reached_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Awaiting first stop arrival'}
            </Text>
          </View>

          {/* Next upcoming stop */}
          <View style={styles.milestoneCard}>
            <View style={styles.milestoneHeader}>
              <View style={[styles.milestoneDot, { backgroundColor: COLORS.blue }]} />
              <Text style={styles.milestoneLabel}>NEXT STOP</Text>
            </View>
            <Text style={styles.milestoneName} numberOfLines={1}>
              {nextStop ? nextStop.name : (totalStops > 0 && completedStops >= totalStops ? 'Final Destination' : 'En Route')}
            </Text>
            <Text style={styles.milestoneSub}>
              {nextStop?.scheduled_time
                ? `Est. ${nextStop.scheduled_time}`
                : 'Approaching waypoint'}
            </Text>
          </View>
        </View>

        {/* GPS Status Row */}
        <View style={styles.gpsStatusRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {currentLocation ? (
              currentLocation.is_stale ? (
                <>
                  <AlertTriangle size={13} color={COLORS.warningText || '#B45309'} />
                  <Text style={[styles.gpsText, { color: COLORS.warningText || '#B45309' }]}>
                    GPS signal is stale ({currentLocation.age_seconds || 60}s ago)
                  </Text>
                </>
              ) : (
                <>
                  <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
                  <Text style={[styles.gpsText, { color: '#15803D' }]}>
                    GPS ● Updated {currentLocation.age_seconds ?? 0}s ago
                  </Text>
                </>
              )
            ) : (
              <>
                <View style={[styles.statusDot, { backgroundColor: COLORS.textMuted }]} />
                <Text style={styles.gpsText}>GPS signal awaiting driver broadcast</Text>
              </>
            )}
          </View>

          {totalStops > 0 && (
            <Text style={styles.progressSummary}>
              {completedStops}/{totalStops} stops reached
            </Text>
          )}
        </View>
      </View>

      {/* ── Telemetry & Assigned Driver HUD ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>BUS & TELEMETRY</Text>
        <TelemetryHUD
          bus={currentBus}
          driver={currentBus}
          location={currentLocation}
          isLive={isTripLive}
        />
      </View>

      {/* ── Route Waypoints Progression (Collapsible) ── */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => setShowFullTimeline(!showFullTimeline)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Route size={16} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>ROUTE WAYPOINTS TIMELINE</Text>
            <View style={styles.stopCountBadge}>
              <Text style={styles.stopCountText}>{stopsToDisplay.length}</Text>
            </View>
          </View>
          {showFullTimeline ? <ChevronUp size={18} color={COLORS.text} /> : <ChevronDown size={18} color={COLORS.text} />}
        </TouchableOpacity>

        {showFullTimeline && (
          <View style={styles.timelineCard}>
            {stopsToDisplay.length > 0 ? (
              <StopTimeline
                stops={stopsToDisplay}
                currentStopId={progress?.current_stop?.id}
                childPickupStop={activeChild?.pickup_stop_name || activeStudentStatus?.student?.pickup_stop_name}
                childDropoffStop={activeChild?.dropoff_stop_name || activeStudentStatus?.student?.dropoff_stop_name}
                isLive={isTripLive}
              />
            ) : (
              <View style={styles.noStopsBox}>
                <ShieldCheck size={28} color={COLORS.textMuted} />
                <Text style={styles.noStopsTitle}>No Active Transit Track</Text>
                <Text style={styles.noStopsSub}>
                  When the driver starts the journey, live stop markers and ETA milestones will populate here.
                </Text>
              </View>
            )}
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
  offlineBox: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  mapCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.md,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: '#FFFFFF',
  },
  mapTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  seatPill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  seatPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  mapWrapper: {
    width: '100%',
    height: Math.min(380, SCREEN_HEIGHT * 0.44),
    backgroundColor: '#E2E8F0',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  badgeLive: {
    backgroundColor: COLORS.successLight,
  },
  badgeInactive: {
    backgroundColor: COLORS.surfaceSubtle,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotLive: {
    backgroundColor: COLORS.success,
  },
  dotInactive: {
    backgroundColor: COLORS.textMuted,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  textLive: {
    color: COLORS.success,
  },
  textInactive: {
    color: COLORS.textSecondary,
  },
  journeyPanel: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  panelEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.6,
  },
  panelStatusText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  syncBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.blue,
  },
  milestoneGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  milestoneCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  milestoneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  milestoneLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  milestoneName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  milestoneSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  gpsStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  gpsText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  progressSummary: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  section: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stopCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9999,
  },
  stopCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  timelineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  noStopsBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.xs,
  },
  noStopsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  noStopsSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
});
