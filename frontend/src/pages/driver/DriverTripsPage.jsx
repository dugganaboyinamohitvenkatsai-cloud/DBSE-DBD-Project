import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import {
  Bus,
  Calendar,
  Clock,
  Play,
  CheckCircle2,
  Radio,
  MapPin,
  Users,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Sun,
  Sunset,
} from 'lucide-react';

export function DriverTripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function loadTrips() {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/driver/trips');
      setTrips(res.trips || []);
    } catch (err) {
      setError(err.message || 'Failed to load assigned trips.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrips();
  }, []);

  async function handleStartTrip(tripId) {
    if (!window.confirm(`Start Trip #${tripId}? You will be directed to live location sharing.`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      await apiRequest(`/driver/trips/${tripId}/start`, { method: 'POST' });
      setSuccess(`Trip #${tripId} started.`);
      navigate('/driver/location');
    } catch (err) {
      setError(err.message || 'Failed to start trip.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompleteTrip(tripId) {
    if (!window.confirm(`Complete Trip #${tripId}? This will end the trip.`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      await apiRequest(`/driver/trips/${tripId}/complete`, { method: 'POST' });
      setSuccess(`Trip #${tripId} marked as completed.`);
      await loadTrips();
    } catch (err) {
      setError(err.message || 'Failed to complete trip.');
    } finally {
      setActionLoading(false);
    }
  }

  const activeTrips = trips.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'STARTED');
  const scheduledTrips = trips.filter((t) => t.status === 'SCHEDULED');
  const completedTrips = trips.filter((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Page Header ── */}
      <div className="sb-page-header">
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              color: '#2563eb',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            <span>FLEET OPERATOR WORKSPACE</span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ color: '#64748b' }}>Assigned Dispatch Schedules</span>
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: '0 0 6px 0',
            }}
          >
            Today's Assigned Transit Runs
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 640 }}>
            View your scheduled corridor runs, start live GPS telemetry, and report trip completion.
          </p>
        </div>

        <div className="sb-header-actions">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#475569',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
            }}
          >
            <ShieldCheck size={16} style={{ color: '#2563eb' }} />
            <span>{trips.length} Assigned Run{trips.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            color: '#991b1b',
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            color: '#15803d',
            fontSize: 13.5,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 0',
            backgroundColor: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            color: '#64748b',
            gap: 12,
          }}
        >
          <Loader2 size={32} className="animate-spin" style={{ color: '#2563eb' }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Retrieving assigned driver runs…</span>
        </div>
      ) : trips.length === 0 ? (
        <div
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: 12,
            border: '1px dashed #cbd5e1',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}
          >
            <Bus size={26} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
            No Trips Assigned
          </h3>
          <p style={{ fontSize: 13.5, color: '#64748b', margin: 0 }}>
            There are currently no active or scheduled trips assigned to your operator account.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* ── Active Trips Section ── */}
          {activeTrips.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#16a34a',
                    boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.2)',
                  }}
                />
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Active En Route Runs ({activeTrips.length})
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {activeTrips.map((trip) => (
                  <div
                    key={trip.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 14,
                      border: '1.5px solid #86efac',
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.08)',
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            backgroundColor: trip.direction === 'PICKUP' ? '#fff7ed' : '#eff6ff',
                            color: trip.direction === 'PICKUP' ? '#c2410c' : '#1d4ed8',
                            border: `1px solid ${trip.direction === 'PICKUP' ? '#fed7aa' : '#bfdbfe'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {trip.direction === 'PICKUP' ? <Sun size={12} /> : <Sunset size={12} />}
                          <span>Trip #{trip.id} • {trip.direction}</span>
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: '#15803d',
                            backgroundColor: '#dcfce7',
                            padding: '2px 8px',
                            borderRadius: 9999,
                            textTransform: 'uppercase',
                          }}
                        >
                          ● {trip.status}
                        </span>
                      </div>

                      <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '10px 0 6px 0' }}>
                        Bus {trip.bus_number} — {trip.route_name}
                      </h3>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          fontSize: 12.5,
                          color: '#64748b',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={13} />
                          {trip.trip_date?.slice(0, 10)}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={13} />
                          {trip.stop_count} Stops
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Users size={13} />
                          {trip.student_count} Students
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="button"
                        className="primary-button"
                        style={{
                          flex: 1,
                          backgroundColor: '#16a34a',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          fontSize: 13,
                          padding: '9px 14px',
                        }}
                        onClick={() => navigate('/driver/location')}
                      >
                        <Radio size={14} />
                        <span>Live Broadcaster</span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={actionLoading}
                        style={{
                          padding: '9px 14px',
                          fontSize: 13,
                          color: '#0f766e',
                          fontWeight: 700,
                        }}
                        onClick={() => handleCompleteTrip(trip.id)}
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Scheduled Trips Section ── */}
          {scheduledTrips.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#2563eb',
                  }}
                />
                <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Upcoming Scheduled Runs ({scheduledTrips.length})
                </h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {scheduledTrips.map((trip) => (
                  <div
                    key={trip.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 14,
                      border: '1px solid #bfdbfe',
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 16,
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.04)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            backgroundColor: trip.direction === 'PICKUP' ? '#fff7ed' : '#eff6ff',
                            color: trip.direction === 'PICKUP' ? '#c2410c' : '#1d4ed8',
                            border: `1px solid ${trip.direction === 'PICKUP' ? '#fed7aa' : '#bfdbfe'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {trip.direction === 'PICKUP' ? <Sun size={12} /> : <Sunset size={12} />}
                          <span>Trip #{trip.id} • {trip.direction}</span>
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#1d4ed8',
                            backgroundColor: '#eff6ff',
                            padding: '2px 8px',
                            borderRadius: 9999,
                            textTransform: 'uppercase',
                          }}
                        >
                          Scheduled
                        </span>
                      </div>

                      <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: '10px 0 6px 0' }}>
                        Bus {trip.bus_number} — {trip.route_name}
                      </h3>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          fontSize: 12.5,
                          color: '#64748b',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={13} />
                          {trip.scheduled_start_at
                            ? new Date(trip.scheduled_start_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={13} />
                          {trip.stop_count} Stops
                        </span>
                      </div>
                    </div>

                    <div>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={actionLoading}
                        style={{
                          width: '100%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          fontSize: 13.5,
                          padding: '10px 16px',
                        }}
                        onClick={() => handleStartTrip(trip.id)}
                      >
                        <Play size={14} fill="currentColor" />
                        <span>Start Trip & Broadcast</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Completed Trips Section ── */}
          {completedTrips.length > 0 && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: '#64748b', margin: '0 0 12px 0' }}>
                Completed Transit History ({completedTrips.length})
              </h2>
              {/* Desktop Table View */}
              <div
                className="hide-mobile"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                }}
              >
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Trip ID
                      </th>
                      <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Bus
                      </th>
                      <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Transit Route
                      </th>
                      <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Direction
                      </th>
                      <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Date
                      </th>
                      <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedTrips.map((trip) => (
                      <tr key={trip.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#64748b', fontSize: 12 }}>
                          #{trip.id}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>
                          {trip.bus_number}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#334155', fontSize: 13.5 }}>
                          {trip.route_name}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600 }}>
                          {trip.direction}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12.5, color: '#64748b' }}>
                          {trip.trip_date?.slice(0, 10)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 9999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: trip.status === 'COMPLETED' ? '#f0fdf4' : '#fff1f2',
                              color: trip.status === 'COMPLETED' ? '#15803d' : '#be123c',
                              border: `1px solid ${trip.status === 'COMPLETED' ? '#bbf7d0' : '#fecdd3'}`,
                            }}
                          >
                            {trip.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Deck */}
              <div className="hide-desktop" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {completedTrips.map((trip) => (
                  <div
                    key={trip.id}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      padding: 14,
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: '#64748b' }}>
                          #{trip.id}
                        </span>
                        <strong style={{ fontSize: 14, color: '#0f172a' }}>{trip.bus_number}</strong>
                      </div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 9999,
                          fontSize: 10.5,
                          fontWeight: 700,
                          background: trip.status === 'COMPLETED' ? '#f0fdf4' : '#fff1f2',
                          color: trip.status === 'COMPLETED' ? '#15803d' : '#be123c',
                          border: `1px solid ${trip.status === 'COMPLETED' ? '#bbf7d0' : '#fecdd3'}`,
                        }}
                      >
                        {trip.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
                      {trip.route_name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                      <span>Direction: <strong>{trip.direction}</strong></span>
                      <span>{trip.trip_date?.slice(0, 10)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
