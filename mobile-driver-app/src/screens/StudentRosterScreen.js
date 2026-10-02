import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  Search,
  Phone,
  CheckCircle2,
  Clock,
  MapPin,
  RefreshCw,
  AlertCircle,
  Compass,
} from 'lucide-react-native';
import { useTracking } from '../context/TrackingContext';
import { fetchTripStudents, updateStudentStatus } from '../api/tripApi';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

const STATUS_OPTIONS = ['WAITING', 'BOARDED', 'DROPPED_OFF', 'ABSENT'];

export function StudentRosterScreen() {
  const { activeTrip, scheduledTrip } = useTracking();
  const currentTrip = activeTrip || scheduledTrip;
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [updatingId, setUpdatingId] = useState(null);

  async function loadRoster(isPull = false) {
    if (!currentTrip?.id) {
      setStudents([]);
      setLoading(false);
      return;
    }

    try {
      if (isPull) setRefreshing(true);
      else setLoading(true);
      const data = await fetchTripStudents(currentTrip.id);
      setStudents(data || []);
    } catch (err) {
      console.warn('[StudentRoster] Failed to load students:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadRoster();
  }, [currentTrip?.id]);

  async function handleToggleStatus(student) {
    if (!currentTrip?.id) return;
    const currentIdx = STATUS_OPTIONS.indexOf(student.transport_status);
    const nextStatus = STATUS_OPTIONS[(currentIdx + 1) % STATUS_OPTIONS.length];

    setUpdatingId(student.student_id);
    try {
      await updateStudentStatus(student.student_id, currentTrip.id, nextStatus);
      setStudents((prev) =>
        prev.map((s) =>
          s.student_id === student.student_id ? { ...s, transport_status: nextStatus } : s
        )
      );
    } catch (err) {
      Alert.alert('Status Update Failed', err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  const filtered = students.filter((s) => {
    const nameMatch = (s.student_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const classMatch = (s.student_class || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = nameMatch || classMatch;

    const matchesFilter =
      statusFilter === 'ALL' ||
      s.transport_status === statusFilter ||
      (statusFilter === 'BOARDED' && (s.transport_status === 'BOARDED' || s.transport_status === 'ON_BUS')) ||
      (statusFilter === 'DROPPED' && s.transport_status === 'DROPPED_OFF');

    return matchesSearch && matchesFilter;
  });

  const waitingCount = students.filter((s) => s.transport_status === 'WAITING' || !s.transport_status).length;
  const boardedCount = students.filter(
    (s) => s.transport_status === 'BOARDED' || s.transport_status === 'ON_BUS'
  ).length;
  const droppedCount = students.filter((s) => s.transport_status === 'DROPPED_OFF').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>STUDENT SAFETY MANIFEST</Text>
            <Text style={styles.subtitle}>
              {currentTrip
                ? `Dispatch #${currentTrip.id} • Bus ${currentTrip.bus_number}`
                : 'No Active Journey in Progress'}
            </Text>
          </View>
          {currentTrip ? (
            <TouchableOpacity
              style={styles.refreshIconBtn}
              onPress={() => loadRoster(true)}
              activeOpacity={0.7}
            >
              <RefreshCw size={15} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Attendance Summary Ribbon */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: COLORS.warning }]}>{waitingCount}</Text>
            <Text style={styles.summaryLabel}>WAITING</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: COLORS.blue }]}>{boardedCount}</Text>
            <Text style={styles.summaryLabel}>ON BOARD</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: COLORS.success }]}>{droppedCount}</Text>
            <Text style={styles.summaryLabel}>DROPPED</Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={styles.searchWrapper}>
          <Search size={16} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search student or class..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {['ALL', 'WAITING', 'BOARDED', 'DROPPED'].map((filter) => {
            const isActive = statusFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterPill, isActive ? styles.filterPillActive : null]}
                onPress={() => setStatusFilter(filter)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, isActive ? styles.filterTextActive : null]}>
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Students List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.student_id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRoster(true)}
              tintColor={COLORS.blue}
            />
          }
          renderItem={({ item }) => {
            const isUpdating = updatingId === item.student_id;
            const isBoarded =
              item.transport_status === 'BOARDED' || item.transport_status === 'ON_BUS';
            const isDropped = item.transport_status === 'DROPPED_OFF';
            const isWaiting = item.transport_status === 'WAITING' || !item.transport_status;

            return (
              <View style={styles.studentCard}>
                <View style={styles.studentInfo}>
                  <View style={styles.nameHeaderRow}>
                    <Text style={styles.studentName}>{item.student_name}</Text>
                    {item.seat_number ? (
                      <View style={styles.seatBadge}>
                        <Text style={styles.seatBadgeText}>Seat {item.seat_number}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.studentMeta}>Class {item.student_class || '—'}</Text>
                    <Text style={styles.dotSeparator}>•</Text>
                    <View style={styles.stopSubRow}>
                      <MapPin size={11} color={COLORS.textSecondary} />
                      <Text style={styles.studentMeta} numberOfLines={1}>
                        {item.pickup_stop_name || 'Designated Stop'}
                      </Text>
                    </View>
                  </View>

                  {item.primary_parent_phone ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${item.primary_parent_phone}`)}
                      style={styles.parentPhoneBtn}
                      activeOpacity={0.7}
                    >
                      <Phone size={12} color={COLORS.blue} />
                      <Text style={styles.parentPhoneText}>
                        Parent: {item.primary_parent_phone}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Status Toggle Button */}
                <TouchableOpacity
                  style={[
                    styles.statusButton,
                    isBoarded
                      ? styles.btnBoarded
                      : isDropped
                      ? styles.btnDropped
                      : styles.btnWaiting,
                  ]}
                  onPress={() => handleToggleStatus(item)}
                  disabled={isUpdating || !currentTrip}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      isBoarded
                        ? styles.textBoarded
                        : isDropped
                        ? styles.textDropped
                        : styles.textWaiting,
                    ]}
                  >
                    {isUpdating
                      ? 'SYNCING...'
                      : isBoarded
                      ? 'ON BOARD ✓'
                      : isDropped
                      ? 'DROPPED 🏁'
                      : 'WAITING ⏳'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Users size={32} color={COLORS.textMuted} strokeWidth={1.8} />
              </View>
              <Text style={styles.emptyTitle}>
                {loading
                  ? 'Loading passenger roster...'
                  : !currentTrip
                  ? 'No Active Dispatch'
                  : 'No Matching Students'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {loading
                  ? 'Fetching enrolled students from server...'
                  : !currentTrip
                  ? 'No bus journey assigned yet. Please check back when dispatch schedules your run.'
                  : 'No student records match the search filter.'}
              </Text>
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
    marginBottom: 12,
  },
  headerLeft: {
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
    fontWeight: '600',
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
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 12,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNum: {
    fontSize: 22,
    fontWeight: '900',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    marginBottom: 10,
    minHeight: 46,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 8,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.4,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 30,
  },
  studentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  studentInfo: {
    flex: 1,
    paddingRight: 10,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  seatBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  seatBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.2,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 3,
    gap: 4,
  },
  studentMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  dotSeparator: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  stopSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  parentPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.blueLight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
  },
  parentPhoneText: {
    fontSize: 11,
    color: COLORS.blue,
    fontWeight: '700',
  },
  statusButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    minWidth: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnWaiting: {
    backgroundColor: COLORS.warningLight,
    borderWidth: 1.5,
    borderColor: COLORS.warningBorder,
  },
  btnBoarded: {
    backgroundColor: COLORS.blueLight,
    borderWidth: 1.5,
    borderColor: COLORS.blueBorder,
  },
  btnDropped: {
    backgroundColor: COLORS.successLight,
    borderWidth: 1.5,
    borderColor: COLORS.successBorder,
  },
  statusButtonText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  textWaiting: {
    color: COLORS.warningText,
  },
  textBoarded: {
    color: COLORS.blue,
  },
  textDropped: {
    color: COLORS.successText,
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
    maxWidth: 260,
  },
});
