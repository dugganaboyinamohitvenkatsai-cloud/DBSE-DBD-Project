import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { LiveRouteMap } from '../../components/LiveRouteMap';
import {
  Shield,
  Bus,
  MapPin,
  Clock,
  Compass,
  Radio,
  UserCheck,
  Phone,
  RefreshCw,
  Layers,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Route as RouteIcon,
  Navigation,
} from 'lucide-react';

function getReassuranceCopy(status, studentStatus, pickupStop, dropoffStop) {
  if (studentStatus === 'ON_BUS' || studentStatus === 'BOARDED') {
    return {
      title: 'Currently On Board Bus',
      subtitle: `En route to ${dropoffStop?.name || 'campus destination'}. Telemetry streaming in real time.`,
      theme: 'live',
      badge: 'On Bus · Safe Transit',
    };
  }
  if (studentStatus === 'DROPPED_OFF') {
    return {
      title: 'Safely Arrived at Destination',
      subtitle: `Disembarked at ${dropoffStop?.name || 'scheduled stop'}. Trip completed.`,
      theme: 'completed',
      badge: 'Arrived Safely',
    };
  }
  if (status === 'IN_PROGRESS' || status === 'LIVE' || status === 'BUS_ON_ROUTE') {
    return {
      title: 'Bus En Route to Pickup',
      subtitle: `Vehicle is progressing along corridor towards ${pickupStop?.name || 'pickup stop'}.`,
      theme: 'live',
      badge: 'Bus En Route',
    };
  }
  if (status === 'TRIP_COMPLETED' || status === 'STOP_REACHED') {
    return {
      title: 'Transit Run Completed',
      subtitle: 'All milestones reached. Bus has concluded today’s scheduled run.',
      theme: 'completed',
      badge: 'Run Completed',
    };
  }
  return {
    title: 'Scheduled Departure (Standby)',
    subtitle: `Bus is staged at depot. Live tracking will engage upon departure.`,
    theme: 'standby',
    badge: 'Scheduled Standby',
  };
}

export function ParentDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'map'
  const intervalRef = useRef(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await apiRequest('/parent/dashboard');
      setDashboard(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Unable to retrieve parent safety dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    intervalRef.current = setInterval(fetchDashboard, 10000);
    return () => clearInterval(intervalRef.current);
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="page-state" style={{ minHeight: 400 }}>
        <RefreshCw size={24} className="sb-spin" style={{ color: 'var(--sb-primary-600)' }} />
        <span>Loading safety dashboard and telemetry…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-box alert-box--danger" style={{ maxWidth: 600, margin: '40px auto' }}>
        <AlertCircle size={20} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <strong>Communication Error</strong>
          <p style={{ margin: '4px 0 10px' }}>{error}</p>
          <button type="button" className="btn-secondary" onClick={fetchDashboard}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { parent, children } = dashboard || { parent: null, children: [] };
  const currentChildData = children && children.length > 0 ? children[selectedChildIndex] || children[0] : null;

  const student = currentChildData?.student;
  const transport = currentChildData?.transport || {};
  const { status, bus, driver, location, journey, trip, pickup_stop, dropoff_stop, student_status } = transport;

  const reassurance = getReassuranceCopy(status, student_status, pickup_stop, dropoff_stop);
  const stopsList = journey?.stops || [];
  const isTripActive = status === 'IN_PROGRESS' || status === 'LIVE' || status === 'BUS_ON_ROUTE';

  return (
    <div className="parent-portal-container">
      {/* ── 1. Reassurance Header Banner ── */}
      <div className="parent-hero-banner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="eyebrow" style={{ color: '#93C5FD', margin: 0 }}>
              Parent & Family Safety Portal
            </span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>Real-Time Transit Verification</span>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            Welcome, {parent?.name || 'Parent'}
          </h2>

          <p style={{ fontSize: 13.5, color: '#CBD5E1', marginTop: 4, maxWidth: 600 }}>
            Continuous tracking, verified boarding notifications, and direct route visibility for your family.
          </p>
        </div>

        {/* Sync & Hotline Quick Capsule */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 'var(--sb-radius-full)',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              fontSize: 12,
              fontWeight: 600,
              color: '#F8FAFC',
            }}
          >
            <span
              className="pulse-dot"
              style={{ backgroundColor: isTripActive ? 'var(--sb-success)' : 'var(--sb-accent-amber)' }}
            />
            <span>{isTripActive ? 'Live Telemetry Active' : 'Fleet Staged (Standby)'}</span>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={fetchDashboard}
            disabled={refreshing}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderColor: 'rgba(255,255,255,0.15)',
              color: '#FFFFFF',
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'sb-spin' : ''} />
            <span>{refreshing ? 'Syncing…' : 'Sync Status'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Child Selector (if multiple children) ── */}
      {children && children.length > 1 && (
        <div className="parent-child-tabs">
          {children.map((item, idx) => (
            <button
              key={item.student.student_id}
              type="button"
              className={`parent-child-tab ${selectedChildIndex === idx ? 'parent-child-tab--active' : ''}`}
              onClick={() => setSelectedChildIndex(idx)}
            >
              <GraduationCap size={15} style={{ color: selectedChildIndex === idx ? 'var(--sb-primary-600)' : 'var(--sb-text-subtle)' }} />
              <span>{item.student.name}</span>
              <span style={{ fontSize: 11, color: 'var(--sb-text-subtle)' }}>Class {item.student.class}</span>
            </button>
          ))}
        </div>
      )}

      {/* If No Children Linked */}
      {(!children || children.length === 0) ? (
        <div className="empty-state" style={{ padding: 48 }}>
          <Shield size={36} style={{ color: 'var(--sb-text-subtle)', marginBottom: 12 }} />
          <h3>No Students Linked to Account</h3>
          <p>Please contact the school transportation administration to register your child’s enrollment.</p>
        </div>
      ) : (
        /* ── 3. Child Transit & Journey View ── */
        <div className="parent-reassurance-card">
          {/* Reassurance Status Header */}
          <div
            className={`parent-status-hero ${
              reassurance.theme === 'live'
                ? 'parent-status-hero--live'
                : reassurance.theme === 'standby'
                ? 'parent-status-hero--scheduled'
                : 'parent-status-hero--standby'
            }`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 'var(--sb-radius-full)',
                  backgroundColor: reassurance.theme === 'live' ? 'var(--sb-success-bg)' : 'var(--sb-primary-50)',
                  border: reassurance.theme === 'live' ? '1px solid var(--sb-success-border)' : '1px solid var(--sb-primary-100)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: reassurance.theme === 'live' ? 'var(--sb-success-text)' : 'var(--sb-primary-700)',
                  fontWeight: 800,
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {student?.name ? student.name.charAt(0) : 'S'}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--sb-text-title)', margin: 0 }}>
                    {student?.name}
                  </h3>
                  <span
                    className="badge-status"
                    style={{
                      backgroundColor: reassurance.theme === 'live' ? 'var(--sb-success-bg)' : 'var(--sb-surface-muted)',
                      color: reassurance.theme === 'live' ? 'var(--sb-success-text)' : 'var(--sb-text-muted)',
                      border: reassurance.theme === 'live' ? '1px solid var(--sb-success-border)' : '1px solid var(--sb-border)',
                    }}
                  >
                    {reassurance.badge}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--sb-text-muted)', marginTop: 2 }}>
                  Class {student?.class} • KLH BHP Student Transit
                </div>
              </div>
            </div>

            {/* Reassurance Subtext */}
            <div style={{ textAlign: 'right', minWidth: 220 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sb-text-title)' }}>
                {reassurance.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--sb-text-muted)', marginTop: 2 }}>
                {reassurance.subtitle}
              </div>
            </div>
          </div>

          {/* Transportation Metadata Strip */}
          <div className="parent-meta-strip">
            {/* Bus Info */}
            <div className="parent-meta-box">
              <div className="parent-meta-label">
                <Bus size={13} />
                <span>Assigned Vehicle</span>
              </div>
              <div className="parent-meta-value">
                {bus?.bus_number || 'Standard Fleet'}
              </div>
              <div className="parent-meta-desc">
                {bus?.registration_number || 'Authorized School Bus'}
              </div>
            </div>

            {/* Route & Direction */}
            <div className="parent-meta-box">
              <div className="parent-meta-label">
                <RouteIcon size={13} />
                <span>Transit Route</span>
              </div>
              <div className="parent-meta-value">
                {trip?.route_name || 'Assigned Corridor'}
              </div>
              <div className="parent-meta-desc">
                {trip?.direction === 'PICKUP' ? 'Morning Pickup Corridor' : 'Evening Dropoff Corridor'}
              </div>
            </div>

            {/* Pickup Milestone */}
            <div className="parent-meta-box">
              <div className="parent-meta-label">
                <MapPin size={13} style={{ color: 'var(--sb-accent-amber)' }} />
                <span>Designated Pickup</span>
              </div>
              <div className="parent-meta-value">
                {pickup_stop?.name || 'Configured Stop'}
              </div>
              <div className="parent-meta-desc">
                {pickup_stop?.stop_order ? `Stop Milestone #${pickup_stop.stop_order}` : 'Registered Stop'}
              </div>
            </div>

            {/* Verified Driver */}
            <div className="parent-meta-box">
              <div className="parent-meta-label">
                <UserCheck size={13} />
                <span>Verified Driver</span>
              </div>
              <div className="parent-meta-value">
                {driver?.name || 'Institutional Operator'}
              </div>
              <div className="parent-meta-desc" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {driver?.phone ? (
                  <a
                    href={`tel:${driver.phone}`}
                    style={{ color: 'var(--sb-primary-600)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Phone size={11} />
                    <span>{driver.phone}</span>
                  </a>
                ) : (
                  <span>Verified License</span>
                )}
              </div>
            </div>
          </div>

          {/* ── 4. Direct In-Page Journey Progression (No Modal Gating) ── */}
          <div
            style={{
              border: '1px solid var(--sb-border)',
              borderRadius: 'var(--sb-radius-md)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              background: 'var(--sb-surface)',
            }}
          >
            {/* Header with View Mode Switcher */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                borderBottom: '1px solid var(--sb-border-subtle)',
                paddingBottom: 14,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="eyebrow" style={{ margin: 0 }}>Route Progression</span>
                  {journey && (
                    <span style={{ fontSize: 12, color: 'var(--sb-text-muted)' }}>
                      ({journey.reached_stops_count || 0} of {journey.total_stops || stopsList.length} stops passed)
                    </span>
                  )}
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--sb-text-title)', marginTop: 2 }}>
                  {trip?.route_name || 'Corridor Journey'}
                </h4>
              </div>

              {/* View Mode Toggle */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className={viewMode === 'timeline' ? 'btn-secondary' : 'table-action-button'}
                  onClick={() => setViewMode('timeline')}
                  style={{
                    backgroundColor: viewMode === 'timeline' ? 'var(--sb-primary-50)' : 'transparent',
                    borderColor: viewMode === 'timeline' ? 'var(--sb-primary-100)' : 'var(--sb-border)',
                    color: viewMode === 'timeline' ? 'var(--sb-primary-700)' : 'var(--sb-text-muted)',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  <Layers size={13} />
                  <span>Stop Timeline</span>
                </button>

                <button
                  type="button"
                  className={viewMode === 'map' ? 'btn-secondary' : 'table-action-button'}
                  onClick={() => setViewMode('map')}
                  style={{
                    backgroundColor: viewMode === 'map' ? 'var(--sb-primary-50)' : 'transparent',
                    borderColor: viewMode === 'map' ? 'var(--sb-primary-100)' : 'var(--sb-border)',
                    color: viewMode === 'map' ? 'var(--sb-primary-700)' : 'var(--sb-text-muted)',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  <MapPin size={13} />
                  <span>Live Map</span>
                </button>
              </div>
            </div>

            {/* Content: Timeline Track vs Map */}
            {viewMode === 'map' ? (
              <div style={{ minHeight: 340 }}>
                <LiveRouteMap
                  stops={stopsList}
                  location={location}
                  busNumber={bus?.bus_number || 'School Bus'}
                />
              </div>
            ) : stopsList.length === 0 ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <p>No milestone stops currently configured for this route.</p>
              </div>
            ) : (
              <div className="ops-corridor-track">
                {stopsList.map((stop, idx) => {
                  const isReached = Boolean(stop.isReached);
                  const isCurrent = stop.status === 'CURRENT' && isTripActive;
                  const isPickup = pickup_stop && stop.id === pickup_stop.id;
                  const isDropoff = dropoff_stop && stop.id === dropoff_stop.id;
                  const isLast = idx === stopsList.length - 1;

                  return (
                    <div key={stop.id} className="ops-stop-node">
                      <div className="ops-node-indicator">
                        <div
                          className={`ops-node-dot ${
                            isCurrent
                              ? 'ops-node-dot--current'
                              : isReached
                              ? 'ops-node-dot--reached'
                              : ''
                          }`}
                        >
                          {isReached ? '✓' : stop.stop_order}
                        </div>
                        {!isLast && (
                          <div
                            className={`ops-node-line ${
                              isReached ? 'ops-node-line--reached' : ''
                            }`}
                          />
                        )}
                      </div>

                      <div className="ops-stop-details">
                        <div className="ops-stop-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span className="ops-stop-name">{stop.name}</span>
                            {isPickup && (
                              <span className="parent-stop-highlight parent-stop-highlight--pickup">
                                Designated Pickup Stop
                              </span>
                            )}
                            {isDropoff && (
                              <span className="parent-stop-highlight parent-stop-highlight--dropoff">
                                Destination Stop
                              </span>
                            )}
                          </div>
                          <span className="ops-stop-time">
                            {stop.scheduled_time ? stop.scheduled_time.slice(0, 5) : `Stop #${stop.stop_order}`}
                          </span>
                        </div>

                        <div className="ops-stop-meta">
                          {isCurrent && (
                            <span style={{ color: 'var(--sb-primary-600)', fontWeight: 700, marginRight: 8 }}>
                              Bus Approaching
                            </span>
                          )}
                          {isReached && (
                            <span style={{ color: 'var(--sb-success)', fontWeight: 600, marginRight: 8 }}>
                              Passed
                            </span>
                          )}
                          <span>
                            {idx === 0
                              ? 'Origin Departure'
                              : isLast
                              ? 'Final Destination · Campus'
                              : `Waypoint Milestone #${stop.stop_order}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* GPS Telemetry Pill */}
            {location && location.latitude && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--sb-radius-sm)',
                  background: 'var(--sb-surface-muted)',
                  border: '1px solid var(--sb-border)',
                  fontSize: 12,
                  color: 'var(--sb-text-muted)',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Radio size={14} style={{ color: 'var(--sb-success)' }} />
                  <span style={{ fontWeight: 600, color: 'var(--sb-text-title)' }}>
                    Physical Telemetry Stream:
                  </span>
                  <span style={{ fontFamily: 'var(--sb-font-mono)' }}>
                    {Number(location.latitude).toFixed(4)}°, {Number(location.longitude).toFixed(4)}°
                  </span>
                  {location.accuracy && (
                    <span>(±{Math.round(location.accuracy)}m)</span>
                  )}
                </div>

                <div style={{ fontSize: 11.5, color: 'var(--sb-text-subtle)' }}>
                  {location.recorded_at
                    ? `Ping: ${new Date(location.recorded_at).toLocaleTimeString()}`
                    : 'Real-time telemetry'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
