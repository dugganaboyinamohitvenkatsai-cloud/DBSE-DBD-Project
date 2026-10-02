import React, { useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bus,
  MapPin,
  Users,
  Navigation,
  ChevronRight,
  RefreshCw,
  Clock,
  Compass,
} from 'lucide-react-native';
import { fetchDriverTrips } from '../api/tripApi';
import { TouchButton } from '../components/TouchButton';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

export function TripsListScreen({ onSelectTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadTrips(isPullRefresh = false) {
    try {
      if (isPullRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await fetchDriverTrips();
      setTrips(data || []);
    } catch (err) {
      console.warn('[TripsList] Failed to load trips:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTrips();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextCol}>
            <Text style={styles.title}>ASSIGNED DISPATCHES</Text>
            <Text style={styles.subtitle}>Scheduled and completed vehicle journeys</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshIconBtn}
            onPress={() => loadTrips(true)}
            activeOpacity={0.7}
          >
            <RefreshCw size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={trips}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadTrips(true)}
              tintColor={COLORS.blue}
              colors={[COLORS.blue]}
            />
          }
          renderItem={({ item }) => {
            const isLive = item.status === 'IN_PROGRESS';
            const isCompleted = item.status === 'COMPLETED';

            return (
              <TouchableOpacity
                style={[
                  styles.tripCard,
                  isLive ? styles.cardLive : isCompleted ? styles.cardCompleted : null,
                ]}
                onPress={() => onSelectTrip(item)}
                activeOpacity={0.8}
              >
                {/* Header row */}
                <View style={styles.cardHeader}>
                  <View style={styles.headerLeft}>
                    <View style={styles.directionRow}>
                      <Navigation size={12} color={isLive ? COLORS.successText : COLORS.blue} />
                      <Text
                        style={[
                          styles.directionText,
                          isLive ? { color: COLORS.successText } : null,
                        ]}
                      >
                        DISPATCH #{item.id} • {item.direction || 'PICKUP'}
                      </Text>
                    </View>
                    <Text style={styles.routeName}>{item.route_name}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      isLive
                        ? styles.pillLive
                        : isCompleted
                        ? styles.pillCompleted
                        : styles.pillScheduled,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: isLive
                            ? COLORS.success
                            : isCompleted
                            ? COLORS.textMuted
                            : COLORS.blue,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        isLive
                          ? styles.textLive
                          : isCompleted
                          ? styles.textCompleted
                          : styles.textScheduled,
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                {/* Metadata Deck */}
                <View style={styles.metaRow}>
                  <View style={styles.metaCol}>
                    <Bus size={13} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>Bus {item.bus_number}</Text>
                  </View>
                  <View style={styles.metaCol}>
                    <MapPin size={13} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{item.stop_count} Stops</Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Users size={13} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{item.student_count ?? 0} Students</Text>
                  </View>
                </View>

                {/* Action button strip */}
                <View style={[styles.actionStrip, isLive ? styles.actionStripLive : null]}>
                  <Text style={[styles.actionStripText, isLive ? styles.actionTextLive : null]}>
                    {isLive ? 'VIEW ACTIVE COCKPIT' : 'INSPECT DISPATCH DETAILS'}
                  </Text>
                  <ChevronRight
                    size={16}
                    color={isLive ? '#FFFFFF' : COLORS.textSecondary}
                    strokeWidth={2.5}
                  />
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Compass size={32} color={COLORS.textMuted} strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>
                {loading ? 'Retrieving assigned runs...' : 'No Assigned Runs'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {loading
                  ? 'Connecting to school dispatch server...'
                  : 'You have no vehicle dispatches assigned to your terminal.'}
              </Text>
              {!loading && (
                <TouchButton
                  title="REFRESH LIST"
                  icon={<RefreshCw size={15} color={COLORS.primary} />}
                  onPress={() => loadTrips(false)}
                  variant="outline"
                  style={{ marginTop: 14 }}
                />
              )}
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  refreshIconBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 30,
  },
  tripCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 12,
    ...SHADOWS.sm,
  },
  cardLive: {
    borderColor: COLORS.successBorder,
    backgroundColor: '#F0FDF4',
  },
  cardCompleted: {
    opacity: 0.9,
    backgroundColor: COLORS.surfaceSubtle,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  directionText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.blue,
    letterSpacing: 0.8,
  },
  routeName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillLive: {
    backgroundColor: COLORS.successLight,
  },
  pillScheduled: {
    backgroundColor: COLORS.blueLight,
  },
  pillCompleted: {
    backgroundColor: '#E2E8F0',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  textLive: {
    color: COLORS.successText,
  },
  textScheduled: {
    color: COLORS.blue,
  },
  textCompleted: {
    color: COLORS.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    marginBottom: 10,
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  actionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceHighlight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
  },
  actionStripLive: {
    backgroundColor: COLORS.success,
  },
  actionStripText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionTextLive: {
    color: '#FFFFFF',
  },
  emptyContainer: {
    padding: 36,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginTop: 20,
    ...SHADOWS.sm,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
});
