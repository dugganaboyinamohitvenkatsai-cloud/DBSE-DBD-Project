import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../lib/api';
import { LiveRouteMap } from '../components/LiveRouteMap';
import {
  Navigation,
  Bus,
  Route,
  Users,
  UserCheck,
  GraduationCap,
  CalendarClock,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  Radio,
  Compass,
  MapPin,
  Layers,
} from 'lucide-react';

function formatDateHeading() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [adminOverview, setAdminOverview] = useState(null);
  const [heroJourney, setHeroJourney] = useState(null);
  const [heroTrip, setHeroTrip] = useState(null);
  const [viewMode, setViewMode] = useState('corridor'); // 'corridor' | 'map'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAdminData = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await apiRequest('/admin/overview');
      setAdminOverview(data);

      // Check if there is an active trip, or pick the first scheduled/recent trip for the hero
      const recent = data.recent_trips || [];
      const activeCandidate = recent.find(
        (t) => t.status === 'IN_PROGRESS' || t.status === 'STARTED'
      );
      const scheduledCandidate = recent.find((t) => t.status === 'SCHEDULED');
      const selectedTrip = activeCandidate || scheduledCandidate || recent[0] || null;

      if (selectedTrip?.id) {
        setHeroTrip(selectedTrip);
        try {
          const journeyData = await apiRequest(`/trips/${selectedTrip.id}/journey`);
          setHeroJourney(journeyData);
        } catch (jErr) {
          console.warn('Failed to load corridor journey payload:', jErr.message);
          setHeroJourney(null);
        }
      } else {
        setHeroTrip(null);
        setHeroJourney(null);
      }
    } catch (err) {
      console.warn('Failed to load admin overview:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function handleSelectTripForHero(trip) {
    setHeroTrip(trip);
    try {
      const journeyData = await apiRequest(`/trips/${trip.id}/journey`);
      setHeroJourney(journeyData);
    } catch (err) {
      console.warn('Failed to load journey for selected trip:', err.message);
    }
  }

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchAdminData();
    } else if (user?.role === 'PARENT') {
      navigate('/parent/dashboard', { replace: true });
    } else {
      setLoading(false);
    }
  }, [user, navigate, fetchAdminData]);

  /* ────────────────── Admin Operations Command Center ────────────────── */
  if (user?.role === 'ADMIN') {
    const metrics = adminOverview?.metrics;
    const recentTrips = adminOverview?.recent_trips || [];
    const activeTripsCount = metrics?.active_trips ?? 0;
    const isLive = activeTripsCount > 0;
    const stopsList = heroJourney?.journey?.stops || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* ── 1. Operations Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, paddingTop: 4 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="eyebrow" style={{ margin: 0 }}>SchoolBus Operations Command Center</span>
              <span style={{ color: 'var(--sb-border-strong)' }}>•</span>
              <span style={{ fontSize: 12, color: 'var(--sb-text-muted)' }}>{formatDateHeading()}</span>
            </div>
            <h2 style={{ fontSize: 24, letterSpacing: '-0.025em', color: 'var(--sb-primary-950)', margin: 0, fontWeight: 800 }}>
              Transit Fleet Dispatch & Safety Operations
            </h2>
            <p style={{ marginTop: 4, fontSize: 13.5, color: 'var(--sb-text-muted)' }}>
              Institutional corridor management, automated stop milestone progression, and live fleet telemetry.
            </p>
          </div>

          {/* Operational Truthful Status & Sync */}
          <div className="ops-header-actions">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                borderRadius: 'var(--sb-radius-full)',
                background: isLive ? 'var(--sb-success-bg)' : 'var(--sb-surface)',
                border: isLive ? '1px solid var(--sb-success-border)' : '1px solid var(--sb-border)',
                fontSize: 12.5,
                fontWeight: 600,
                color: isLive ? 'var(--sb-success-text)' : 'var(--sb-text-title)',
                boxShadow: 'var(--sb-shadow-xs)',
              }}
            >
              <span className="pulse-dot" style={{ backgroundColor: isLive ? 'var(--sb-success)' : 'var(--sb-accent-amber)' }} />
              <span>
                {isLive
                  ? `${activeTripsCount} Active Transit Run${activeTripsCount > 1 ? 's' : ''} En Route`
                  : `Fleet Standby · ${metrics?.today_trips ?? 0} Scheduled Run${(metrics?.today_trips ?? 0) === 1 ? '' : 's'} Today`}
              </span>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={fetchAdminData}
              disabled={refreshing}
              title="Refresh operations telemetry"
              style={{ padding: '7px 14px', fontSize: 12.5, backgroundColor: 'var(--sb-surface)' }}
            >
              <RefreshCw
                size={14}
                className={refreshing ? 'sb-spin' : ''}
                style={{ color: 'var(--sb-primary-600)' }}
              />
              <span>{refreshing ? 'Syncing…' : 'Sync Fleet'}</span>
            </button>
          </div>
        </div>

        {/* ── 2. Unified Operations Telemetry Strip ── */}
        <div className="ops-telemetry-strip">
          {/* Active Fleet */}
          <Link
            to="/admin/trips"
            className={`ops-telemetry-cell ${isLive ? 'ops-telemetry-cell--live' : ''}`}
          >
            <div className="ops-telemetry-label">
              <span>Active Fleet</span>
              <Navigation size={14} style={{ color: isLive ? 'var(--sb-success)' : 'var(--sb-text-subtle)' }} />
            </div>
            <div className="ops-telemetry-value">
              {activeTripsCount}
            </div>
            <div className="ops-telemetry-desc">
              {isLive ? 'Vehicles en route now' : 'Vehicles staged at depot'}
            </div>
          </Link>

          {/* Today's Runs */}
          <Link
            to="/admin/trips"
            className="ops-telemetry-cell ops-telemetry-cell--highlight"
          >
            <div className="ops-telemetry-label">
              <span>Today's Runs</span>
              <CalendarClock size={14} style={{ color: 'var(--sb-primary-500)' }} />
            </div>
            <div className="ops-telemetry-value">
              {metrics?.today_trips ?? 0}
            </div>
            <div className="ops-telemetry-desc">
              Assigned daily schedules
            </div>
          </Link>

          {/* Transit Students */}
          <Link to="/admin/students" className="ops-telemetry-cell">
            <div className="ops-telemetry-label">
              <span>Students</span>
              <GraduationCap size={14} style={{ color: 'var(--sb-text-subtle)' }} />
            </div>
            <div className="ops-telemetry-value">
              {metrics?.students ?? 0}
            </div>
            <div className="ops-telemetry-desc">
              Active enrolled riders
            </div>
          </Link>

          {/* Fleet Buses */}
          <Link to="/admin/buses" className="ops-telemetry-cell">
            <div className="ops-telemetry-label">
              <span>Fleet Buses</span>
              <Bus size={14} style={{ color: 'var(--sb-text-subtle)' }} />
            </div>
            <div className="ops-telemetry-value">
              {metrics?.buses ?? 0}
            </div>
            <div className="ops-telemetry-desc">
              Operational vehicles
            </div>
          </Link>

          {/* Verified Drivers */}
          <Link to="/admin/drivers" className="ops-telemetry-cell">
            <div className="ops-telemetry-label">
              <span>Drivers</span>
              <UserCheck size={14} style={{ color: 'var(--sb-text-subtle)' }} />
            </div>
            <div className="ops-telemetry-value">
              {metrics?.drivers ?? 0}
            </div>
            <div className="ops-telemetry-desc">
              Licensed operators
            </div>
          </Link>

          {/* Corridors */}
          <Link to="/admin/routes" className="ops-telemetry-cell">
            <div className="ops-telemetry-label">
              <span>Corridors</span>
              <Route size={14} style={{ color: 'var(--sb-text-subtle)' }} />
            </div>
            <div className="ops-telemetry-value">
              {metrics?.routes ?? 0}
            </div>
            <div className="ops-telemetry-desc">
              Mapped route paths
            </div>
          </Link>
        </div>

        {/* ── 3. Primary Operations Command Center: Hero Route & Telemetry ── */}
        <div className="ops-command-grid">
          {/* ── Left Column: Route Corridor & Stop Progression Visualizer (The Hero) ── */}
          <div className="ops-surface" style={{ minHeight: 460 }}>
            {/* Visualizer Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 16,
                borderBottom: '1px solid var(--sb-border)',
                marginBottom: 18,
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="badge-status"
                    style={{
                      backgroundColor: isLive ? 'var(--sb-success-bg)' : 'var(--sb-surface-muted)',
                      color: isLive ? 'var(--sb-success-text)' : 'var(--sb-text-muted)',
                      border: isLive ? '1px solid var(--sb-success-border)' : '1px solid var(--sb-border)',
                    }}
                  >
                    {isLive ? '● Live Telemetry Streaming' : '● Planned Corridor Schedule (Standby)'}
                  </span>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--sb-text-title)', marginTop: 4 }}>
                  {heroTrip
                    ? `${heroTrip.route_name} — Bus ${heroTrip.bus_number}`
                    : 'Corridor Progression'}
                </h3>
              </div>

              {/* View Switcher: Corridor Milestone Track vs Vector Map */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className={viewMode === 'corridor' ? 'btn-secondary' : 'table-action-button'}
                  onClick={() => setViewMode('corridor')}
                  style={{
                    backgroundColor: viewMode === 'corridor' ? 'var(--sb-primary-50)' : 'transparent',
                    borderColor: viewMode === 'corridor' ? 'var(--sb-primary-100)' : 'var(--sb-border)',
                    color: viewMode === 'corridor' ? 'var(--sb-primary-700)' : 'var(--sb-text-muted)',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  <Layers size={13} />
                  <span>Milestone Track</span>
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
                  <span>Geographic Map</span>
                </button>
              </div>
            </div>

            {/* Content: Milestone Track or Geographic Map */}
            {loading ? (
              <div className="page-state" style={{ minHeight: 280 }}>
                <RefreshCw size={22} className="sb-spin" style={{ color: 'var(--sb-primary-600)' }} />
                <span>Loading corridor progression…</span>
              </div>
            ) : viewMode === 'map' ? (
              <div style={{ flex: 1 }}>
                <LiveRouteMap
                  stops={stopsList}
                  location={heroJourney?.location}
                  busNumber={heroTrip?.bus_number}
                />
              </div>
            ) : stopsList.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <p>No configured stops found for this corridor.</p>
              </div>
            ) : (
              /* Milestone Track Visualizer */
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 12, color: 'var(--sb-text-muted)', marginBottom: 14 }}>
                  {isLive
                    ? 'Automated stop detection tracks each milestone in real time.'
                    : 'Planned stop sequence for departure. Milestones transition automatically as the vehicle progresses along the route.'}
                </div>

                <div className="ops-corridor-track">
                  {stopsList.map((stop, idx) => {
                    const isReached = Boolean(stop.isReached);
                    const isCurrent = stop.status === 'CURRENT' && isLive;
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
                            <span className="ops-stop-name">{stop.name}</span>
                            <span className="ops-stop-time">
                              {stop.scheduled_time ? stop.scheduled_time.slice(0, 5) : `Stop #${stop.stop_order}`}
                            </span>
                          </div>

                          <div className="ops-stop-meta">
                            {idx === 0
                              ? 'Origin Departure Stop'
                              : isLast
                              ? 'Final Destination · KLH BHP Main Campus'
                              : `Transit Milestone #${stop.stop_order}`}
                            {isCurrent && (
                              <span style={{ color: 'var(--sb-primary-600)', fontWeight: 700, marginLeft: 8 }}>
                                🚌 Approaching Stop
                              </span>
                            )}
                            {isReached && (
                              <span style={{ color: 'var(--sb-success)', fontWeight: 600, marginLeft: 8 }}>
                                Reached
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Column: Operational Dossier & Dispatch Status ── */}
          <div className="ops-surface" style={{ gap: 18 }}>
            <div>
              <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Compass size={13} />
                Dispatch Dossier
              </span>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--sb-text-title)', marginTop: 2 }}>
                {heroTrip ? `Run Dossier: Trip #${heroTrip.id}` : 'Operational Dossier'}
              </h3>
            </div>

            {heroTrip ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Status Indicator */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--sb-radius-md)',
                    background: heroTrip.status === 'IN_PROGRESS'
                      ? 'var(--sb-success-bg)'
                      : heroTrip.status === 'SCHEDULED'
                      ? 'var(--sb-info-bg)'
                      : 'var(--sb-surface-muted)',
                    border: heroTrip.status === 'IN_PROGRESS'
                      ? '1px solid var(--sb-success-border)'
                      : heroTrip.status === 'SCHEDULED'
                      ? '1px solid var(--sb-info-border)'
                      : '1px solid var(--sb-border)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sb-text-subtle)', textTransform: 'uppercase' }}>
                    Operational Status
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--sb-text-title)', marginTop: 2 }}>
                    {heroTrip.status === 'IN_PROGRESS'
                      ? 'In Transit · Live GPS Active'
                      : heroTrip.status === 'SCHEDULED'
                      ? 'Scheduled · Staged for Departure'
                      : `${heroTrip.status} · Concluded`}
                  </div>
                </div>

                {/* Dossier Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    background: 'var(--sb-surface-muted)',
                    border: '1px solid var(--sb-border)',
                    borderRadius: 'var(--sb-radius-md)',
                    padding: '14px 16px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--sb-text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Assigned Bus
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sb-text-title)', marginTop: 2 }}>
                      {heroTrip.bus_number}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)' }}>
                      {heroTrip.registration_number || 'Standard Fleet'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--sb-text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Fleet Driver
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sb-text-title)', marginTop: 2 }}>
                      {heroTrip.driver_name || 'Assigned Driver'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)' }}>
                      {heroTrip.driver_employee_code || heroTrip.driver_code || 'Verified Operator'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--sb-text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Departure Schedule
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sb-text-title)', marginTop: 2 }}>
                      {formatTime(heroTrip.scheduled_start_at)}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)' }}>
                      {heroTrip.direction === 'PICKUP' ? 'Morning Pickup' : 'Evening Dropoff'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--sb-text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>
                      Milestones
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sb-text-title)', marginTop: 2 }}>
                      {stopsList.length} Configured Stops
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)' }}>
                      Sequential route corridor
                    </div>
                  </div>
                </div>

                {/* Telemetry Truth Statement */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--sb-radius-sm)',
                    border: '1px solid var(--sb-border)',
                    background: 'var(--sb-surface)',
                    fontSize: 12,
                    color: 'var(--sb-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  <Radio size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6, color: 'var(--sb-primary-500)' }} />
                  {isLive
                    ? 'Transmitting device coordinates. Waypoint arrivals evaluate against stop coordinates.'
                    : 'Awaiting driver mobile GPS connection. Live stop arrivals engage upon run departure.'}
                </div>

                {/* Quick Link to Trips Management */}
                <Link
                  to="/admin/trips"
                  className="primary-button"
                  style={{ width: '100%', textDecoration: 'none' }}
                >
                  <span>Open Full Trips Hub</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 24 }}>
                <p>No dispatch schedule available.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. Today's Operations: Fleet Dispatch Timeline Cards ── */}
        <div className="panel" style={{ padding: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <span className="eyebrow">Dispatch Manifest</span>
              <h3 style={{ fontSize: 17, margin: 0, fontWeight: 800 }}>
                Recent & Scheduled Transit Operations
              </h3>
            </div>

            <Link to="/admin/trips" className="table-action-button" style={{ fontSize: 12 }}>
              <span>View All Dispatch Schedules</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {recentTrips.length === 0 ? (
            <p style={{ color: 'var(--sb-text-muted)', fontSize: 14 }}>
              No transportation runs recorded in the database.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentTrips.map((trip) => {
                const isSelected = heroTrip?.id === trip.id;

                return (
                  <div
                    key={trip.id}
                    className={`ops-dispatch-card ${
                      trip.status === 'IN_PROGRESS'
                        ? 'ops-dispatch-card--active'
                        : trip.status === 'SCHEDULED'
                        ? 'ops-dispatch-card--scheduled'
                        : 'ops-dispatch-card--completed'
                    }`}
                  >
                    {/* Left: Trip ID & Direction */}
                    <div style={{ minWidth: 100 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--sb-text-title)' }}>
                          Trip #{trip.id}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)', marginTop: 2 }}>
                        {trip.direction === 'PICKUP' ? 'Morning' : 'Evening'}
                      </div>
                    </div>

                    {/* Middle: Route & Bus Details */}
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sb-text-title)' }}>
                        {trip.route_name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--sb-text-muted)', marginTop: 2 }}>
                        Bus: <strong>{trip.bus_number}</strong> • Driver: {trip.driver_name || 'Assigned Driver'}
                      </div>
                    </div>

                    {/* Schedule Time */}
                    <div style={{ minWidth: 120 }}>
                      <div style={{ fontSize: 11, color: 'var(--sb-text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Departure
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sb-text-title)' }}>
                        {formatTime(trip.scheduled_start_at)}
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      <span
                        className="badge-status"
                        style={{
                          backgroundColor:
                            trip.status === 'IN_PROGRESS'
                              ? 'var(--sb-success-bg)'
                              : trip.status === 'SCHEDULED'
                              ? 'var(--sb-info-bg)'
                              : 'var(--sb-surface-subtle)',
                          color:
                            trip.status === 'IN_PROGRESS'
                              ? 'var(--sb-success-text)'
                              : trip.status === 'SCHEDULED'
                              ? 'var(--sb-info-text)'
                              : 'var(--sb-text-muted)',
                          border:
                            trip.status === 'IN_PROGRESS'
                              ? '1px solid var(--sb-success-border)'
                              : trip.status === 'SCHEDULED'
                              ? '1px solid var(--sb-info-border)'
                              : '1px solid var(--sb-border)',
                        }}
                      >
                        {trip.status}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleSelectTripForHero(trip)}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          backgroundColor: isSelected ? 'var(--sb-primary-50)' : 'var(--sb-surface)',
                          borderColor: isSelected ? 'var(--sb-primary-500)' : 'var(--sb-border)',
                          color: isSelected ? 'var(--sb-primary-700)' : 'var(--sb-text-title)',
                          fontWeight: 600,
                        }}
                      >
                        {isSelected ? 'Loaded in Hero' : 'Inspect in Hero'}
                      </button>

                      <Link
                        to="/admin/trips"
                        className="table-action-button"
                        style={{ padding: '6px 10px' }}
                        title="Open trip in dispatch manager"
                      >
                        <ExternalLink size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 5. Administrative Quick Operations Bar ── */}
        <div className="panel" style={{ padding: '18px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Administrative Operations Shortcuts
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
            }}
          >
            <Link
              to="/admin/trips"
              className="btn-secondary"
              style={{ justifyContent: 'flex-start', padding: '9px 14px', textDecoration: 'none' }}
            >
              <Navigation size={15} style={{ color: 'var(--sb-primary-600)' }} />
              <span>Trips Dispatch</span>
            </Link>

            <Link
              to="/admin/routes"
              className="btn-secondary"
              style={{ justifyContent: 'flex-start', padding: '9px 14px', textDecoration: 'none' }}
            >
              <Route size={15} style={{ color: 'var(--sb-primary-600)' }} />
              <span>Route Corridors</span>
            </Link>

            <Link
              to="/admin/buses"
              className="btn-secondary"
              style={{ justifyContent: 'flex-start', padding: '9px 14px', textDecoration: 'none' }}
            >
              <Bus size={15} style={{ color: 'var(--sb-primary-600)' }} />
              <span>Fleet Vehicles</span>
            </Link>

            <Link
              to="/admin/drivers"
              className="btn-secondary"
              style={{ justifyContent: 'flex-start', padding: '9px 14px', textDecoration: 'none' }}
            >
              <UserCheck size={15} style={{ color: 'var(--sb-primary-600)' }} />
              <span>Driver Records</span>
            </Link>

            <Link
              to="/admin/students"
              className="btn-secondary"
              style={{ justifyContent: 'flex-start', padding: '9px 14px', textDecoration: 'none' }}
            >
              <GraduationCap size={15} style={{ color: 'var(--sb-primary-600)' }} />
              <span>Student Riders</span>
            </Link>

            <Link
              to="/admin/parents"
              className="btn-secondary"
              style={{ justifyContent: 'flex-start', padding: '9px 14px', textDecoration: 'none' }}
            >
              <Users size={15} style={{ color: 'var(--sb-primary-600)' }} />
              <span>Parent Directory</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ────────────────── Driver Dashboard (Preserved Intact) ────────────────── */
  if (user?.role === 'DRIVER') {
    return (
      <section>
        <div className="panel hero-panel" style={{ marginBottom: 20 }}>
          <p className="eyebrow">Driver Workspace</p>
          <h2>Welcome, {user.full_name}</h2>
          <p>Manage daily trips, share live GPS coordinates, and monitor student safety.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div className="panel" style={{ border: '2px solid #86efac', background: '#f0fdf4' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a' }}>🛰️ LIVE LOCATION SHARING</div>
            <h3 style={{ marginTop: 8, fontSize: 18, color: '#14532d' }}>Broadcast Bus GPS</h3>
            <p style={{ fontSize: 13, color: '#4b5563', marginTop: 6 }}>
              Transmit your real device GPS coordinates to track stop arrivals and notify parents automatically.
            </p>
            <button
              type="button"
              className="primary-button"
              style={{ background: '#16a34a', marginTop: 14, width: 'auto' }}
              onClick={() => navigate('/driver/location')}
            >
              Open GPS Broadcaster ↗
            </button>
          </div>

          <div className="panel" style={{ border: '1px solid #bfdbfe', background: '#eff6ff' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>📋 TODAY’S TRIPS</div>
            <h3 style={{ marginTop: 8, fontSize: 18, color: '#1e3a8a' }}>Assigned Schedule</h3>
            <p style={{ fontSize: 13, color: '#4b5563', marginTop: 6 }}>
              View scheduled runs for today, start assigned trips, and verify route stops.
            </p>
            <button
              type="button"
              className="primary-button"
              style={{ background: '#2563eb', marginTop: 14, width: 'auto' }}
              onClick={() => navigate('/driver/trips')}
            >
              View Assigned Trips ↗
            </button>
          </div>

          <div className="panel">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>👥 STUDENT SAFETY</div>
            <h3 style={{ marginTop: 8, fontSize: 18 }}>Attendance & Boarding</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
              Mark students as Boarded, Dropped Off, or Absent for your active trip in real time.
            </p>
            <button
              type="button"
              className="table-action-button"
              style={{ marginTop: 14 }}
              onClick={() => navigate('/driver/students')}
            >
              Manage Boarding ↗
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ────────────────── Parent Dashboard (Handled via Redirect) ────────────────── */
  return null;
}
