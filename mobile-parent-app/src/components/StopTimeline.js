import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, MapPin, Navigation, Clock, Flag } from 'lucide-react-native';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

/**
 * StopTimeline
 * RedBus/Transit-style vertical waypoint progression
 */
export default function StopTimeline({
  stops = [],
  currentStopId = null,
  childPickupStop = '',
  childDropoffStop = '',
  isLive = false,
}) {
  if (!stops || stops.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Route waypoints are not currently available.</Text>
      </View>
    );
  }

  // Normalize stops
  return (
    <View style={styles.container}>
      {stops.map((stop, index) => {
        const isFirst = index === 0;
        const isLast = index === stops.length - 1;
        
        // Status resolution
        const status = stop.status || (stop.completed_at ? 'COMPLETED' : 'PENDING');
        const isCompleted = status === 'COMPLETED';
        const isCurrent = status === 'CURRENT' || (currentStopId && (stop.id === currentStopId || stop.stop_id === currentStopId));
        const isPending = !isCompleted && !isCurrent;

        // Child stop match
        const stopName = stop.stop_name || stop.name || `Stop #${stop.stop_sequence || index + 1}`;
        const isChildPickup = childPickupStop && stopName.toLowerCase().trim() === childPickupStop.toLowerCase().trim();
        const isChildDropoff = childDropoffStop && stopName.toLowerCase().trim() === childDropoffStop.toLowerCase().trim();
        const isChildStop = isChildPickup || isChildDropoff;

        // Time display
        const displayTime = stop.completed_at
          ? `Reached ${new Date(stop.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : stop.planned_arrival_time
          ? `ETA ${stop.planned_arrival_time.substring(0, 5)}`
          : null;

        return (
          <View key={stop.id || stop.stop_id || index} style={styles.itemRow}>
            {/* Left column: timeline line and node */}
            <View style={styles.timelineColumn}>
              {/* Top line segment */}
              {!isFirst && (
                <View
                  style={[
                    styles.lineSegment,
                    isCompleted || isCurrent ? styles.lineSegmentActive : styles.lineSegmentInactive,
                  ]}
                />
              )}
              {isFirst && <View style={styles.lineSpacer} />}

              {/* Node Icon */}
              <View
                style={[
                  styles.nodeCircle,
                  isCompleted && styles.nodeCompleted,
                  isCurrent && styles.nodeCurrent,
                  isPending && styles.nodePending,
                  isChildStop && styles.nodeChildStop,
                ]}
              >
                {isCompleted ? (
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                ) : isCurrent ? (
                  <Navigation size={14} color="#FFFFFF" strokeWidth={2.5} />
                ) : isLast ? (
                  <Flag size={12} color={COLORS.textMuted} strokeWidth={2} />
                ) : (
                  <View style={[styles.innerDot, isChildStop && styles.innerDotChild]} />
                )}
              </View>

              {/* Bottom line segment */}
              {!isLast && (
                <View
                  style={[
                    styles.lineSegment,
                    isCompleted ? styles.lineSegmentActive : styles.lineSegmentInactive,
                  ]}
                />
              )}
              {isLast && <View style={styles.lineSpacer} />}
            </View>

            {/* Right column: Stop content card */}
            <View
              style={[
                styles.contentBox,
                isCurrent && styles.contentBoxCurrent,
                isChildStop && styles.contentBoxChild,
              ]}
            >
              <View style={styles.headerRow}>
                <Text
                  style={[
                    styles.stopName,
                    isCompleted && styles.stopNameCompleted,
                    isCurrent && styles.stopNameCurrent,
                  ]}
                  numberOfLines={1}
                >
                  {stopName}
                </Text>

                {displayTime && (
                  <View style={styles.timeBadge}>
                    <Clock size={11} color={isCompleted ? COLORS.successText : COLORS.textSecondary} />
                    <Text
                      style={[
                        styles.timeText,
                        isCompleted && styles.timeTextCompleted,
                      ]}
                    >
                      {displayTime}
                    </Text>
                  </View>
                )}
              </View>

              {/* Badges */}
              <View style={styles.badgesRow}>
                <View style={styles.seqBadge}>
                  <Text style={styles.seqText}>Stop #{stop.stop_sequence || index + 1}</Text>
                </View>

                {isCurrent && (
                  <View style={styles.liveBadge}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.liveText}>CURRENT STOP</Text>
                  </View>
                )}

                {isChildPickup && (
                  <View style={styles.childBadge}>
                    <MapPin size={11} color={COLORS.blue} />
                    <Text style={styles.childBadgeText}>Assigned Pickup Stop</Text>
                  </View>
                )}

                {isChildDropoff && (
                  <View style={[styles.childBadge, styles.childBadgeDropoff]}>
                    <MapPin size={11} color={COLORS.primary} />
                    <Text style={[styles.childBadgeText, styles.childBadgeDropoffText]}>
                      Assigned Dropoff Stop
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.xs,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  itemRow: {
    flexDirection: 'row',
    minHeight: 64,
  },
  timelineColumn: {
    width: 36,
    alignItems: 'center',
  },
  lineSegment: {
    width: 2.5,
    flex: 1,
  },
  lineSpacer: {
    flex: 1,
  },
  lineSegmentActive: {
    backgroundColor: COLORS.success,
  },
  lineSegmentInactive: {
    backgroundColor: COLORS.border,
  },
  nodeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginVertical: 2,
  },
  nodeCompleted: {
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.successLight,
  },
  nodeCurrent: {
    backgroundColor: COLORS.blue,
    borderWidth: 3,
    borderColor: COLORS.blueBorder,
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  nodePending: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.borderStrong,
  },
  nodeChildStop: {
    borderColor: COLORS.blue,
  },
  innerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textMuted,
  },
  innerDotChild: {
    backgroundColor: COLORS.blue,
  },
  contentBox: {
    flex: 1,
    paddingLeft: SPACING.sm,
    paddingRight: SPACING.xs,
    paddingVertical: SPACING.sm,
    justifyContent: 'center',
  },
  contentBoxCurrent: {
    backgroundColor: COLORS.blueLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
  },
  contentBoxChild: {
    // Subtle accent if it's the child's stop
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  stopName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  stopNameCompleted: {
    color: COLORS.textSecondary,
  },
  stopNameCurrent: {
    color: COLORS.blue,
    fontWeight: '700',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  timeTextCompleted: {
    color: COLORS.successText,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  seqBadge: {
    backgroundColor: COLORS.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  seqText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.blue,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  childBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.blueLight,
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  childBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.blue,
  },
  childBadgeDropoff: {
    backgroundColor: COLORS.surfaceHighlight,
    borderColor: COLORS.borderStrong,
  },
  childBadgeDropoffText: {
    color: COLORS.primary,
  },
});
