import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { RedBusJourneyTracker } from '../../components/RedBusJourneyTracker';

export function DriverLocationPage() {
  const [tripData, setTripData] = useState(null);
  const [scheduledTrip, setScheduledTrip] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'tracking' | 'error' | 'denied'
  const [currentCoords, setCurrentCoords] = useState(null);
  const [lastSentTime, setLastSentTime] = useState(null);
  const [recentNotification, setRecentNotification] = useState(null);

  const watchIdRef = useRef(null);
  const lastSendTimestampRef = useRef(0);

  // Load driver's active trip and route stops
  async function fetchActiveTrip() {
    try {
      const res = await apiRequest('/driver/active-trip');
      setTripData(res.activeTrip || null);
      setScheduledTrip(res.scheduledTrip || null);
      setError('');

      // If active trip exists, also load enrolled students
      if (res.activeTrip?.id) {
        loadStudents(res.activeTrip.id);
      } else {
        setStudents([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load active trip.');
    } finally {
      setLoading(false);
    }
  }

  async function loadStudents(tripId) {
    try {
      setLoadingStudents(true);
      const res = await apiRequest(`/driver/trips/${tripId}/students`);
      setStudents(res.students || []);
    } catch (err) {
      console.warn('Failed to load students for trip:', err.message);
    } finally {
      setLoadingStudents(false);
    }
  }

  useEffect(() => {
    fetchActiveTrip();
    const interval = setInterval(fetchActiveTrip, 10000); // refresh trip state every 10s
    return () => clearInterval(interval);
  }, []);

  // Send GPS location to backend
  async function sendGpsUpdate(coords) {
    try {
      const payload = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        timestamp: new Date().toISOString(),
      };

      const res = await apiRequest('/driver/location', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setLastSentTime(new Date());

      // If a new stop was reached, surface a banner notification
      if (res.stop_event) {
        setRecentNotification(res.stop_event);
        // Refresh active trip progression
        fetchActiveTrip();
      }
    } catch (err) {
      console.warn('Failed to send GPS location:', err.message);
    }
  }

  // Start Real Browser/Device Geolocation Tracking
  function startTracking() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your device/browser.');
      setGpsStatus('error');
      return;
    }

    setIsTracking(true);
    setGpsStatus('tracking');
    setError('');

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setCurrentCoords(coords);
        setGpsStatus('tracking');

        // Throttle updates: send at most once every 6 seconds
        const now = Date.now();
        if (now - lastSendTimestampRef.current >= 6000) {
          lastSendTimestampRef.current = now;
          sendGpsUpdate(coords);
        }
      },
      (geoError) => {
        setIsTracking(false);
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setGpsStatus('denied');
          setError('Location permission was denied. Please allow location access in your browser settings.');
        } else {
          setGpsStatus('error');
          setError(`GPS Error: ${geoError.message}`);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    watchIdRef.current = id;
  }

  // Stop Geolocation Tracking
  function stopTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setGpsStatus('idle');
  }

  // Driver action: Start Trip
  async function handleStartTrip(tripId) {
    if (!window.confirm(`Start Trip #${tripId}? Live GPS tracking will be ready to broadcast.`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      await apiRequest(`/driver/trips/${tripId}/start`, { method: 'POST' });
      setSuccessMessage(`Trip #${tripId} started successfully. You can now enable GPS tracking.`);
      await fetchActiveTrip();
      // Automatically prompt to start GPS
      startTracking();
    } catch (err) {
      setError(err.message || 'Failed to start trip.');
    } finally {
      setActionLoading(false);
    }
  }

  // Driver action: Complete Trip
  async function handleCompleteTrip(tripId) {
    if (!window.confirm(`Complete Trip #${tripId}? This will end the trip and stop GPS broadcasting.`)) {
      return;
    }

    try {
      setActionLoading(true);
      setError('');
      await apiRequest(`/driver/trips/${tripId}/complete`, { method: 'POST' });
      stopTracking();
      setSuccessMessage(`Trip #${tripId} has been successfully completed!`);
      setTripData(null);
      await fetchActiveTrip();
    } catch (err) {
      setError(err.message || 'Failed to complete trip.');
    } finally {
      setActionLoading(false);
    }
  }

  // Update student boarding status
  async function handleUpdateStudentStatus(studentId, newStatus) {
    if (!tripData?.id) return;
    try {
      await apiRequest(`/admin/students/${studentId}/transport-status`, {
        method: 'PUT',
        body: JSON.stringify({
          trip_id: tripData.id,
          status: newStatus,
        }),
      });
      // Refresh students
      loadStudents(tripData.id);
    } catch (err) {
      setError(`Failed to update student status: ${err.message}`);
    }
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <section>
      {/* ── Page Header ── */}
      <div className="panel hero-panel" style={{ marginBottom: 18 }}>
        <p className="eyebrow">Driver Portal</p>
        <h2>Live Bus Journey & Location Sharing</h2>
        <p>Broadcast your device GPS coordinates to track stops and notify parents in real time.</p>
      </div>

      {error && (
        <div className="alert-box alert-box--warning" style={{ marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {successMessage && (
        <div className="alert-box alert-box--success" style={{ marginBottom: 16 }}>
          ✅ {successMessage}
        </div>
      )}

      {recentNotification && (
        <div className="alert-box alert-box--success" style={{ marginBottom: 16 }}>
          🎉 <strong>Stop Reached:</strong> {recentNotification.stop.name}
          {recentNotification.is_final_stop ? ' (Final Destination!)' : ''} — Notification sent to {recentNotification.notifications_sent} parent(s).
        </div>
      )}

      {loading ? (
        <div className="page-state" style={{ minHeight: 180 }}>Loading driver trip details…</div>
      ) : tripData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* ── Active Trip Control Panel ── */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge-count" style={{ background: '#ede9fe', color: '#5b21b6' }}>
                    Trip #{tripData.id} • {tripData.direction}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      background: '#dcfce7',
                      color: '#15803d',
                      padding: '2px 8px',
                      borderRadius: 6,
                    }}
                  >
                    ● {tripData.status}
                  </span>
                </div>
                <h3 style={{ marginTop: 6, fontSize: 18 }}>
                  Bus {tripData.bus_number} — {tripData.route_name}
                </h3>
              </div>

              {/* Action Buttons: GPS Tracking + Complete Trip */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {!isTracking ? (
                  <button
                    type="button"
                    className="primary-button"
                    style={{ background: '#16a34a', margin: 0, padding: '10px 20px', width: 'auto' }}
                    onClick={startTracking}
                  >
                    🛰️ Start GPS Tracking
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-danger"
                    style={{ margin: 0, padding: '10px 20px', width: 'auto' }}
                    onClick={stopTracking}
                  >
                    🛑 Stop GPS Tracking
                  </button>
                )}

                <button
                  type="button"
                  className="primary-button"
                  disabled={actionLoading}
                  style={{
                    background: '#0284c7',
                    margin: 0,
                    padding: '10px 18px',
                    width: 'auto',
                    opacity: actionLoading ? 0.6 : 1,
                  }}
                  onClick={() => handleCompleteTrip(tripData.id)}
                >
                  {actionLoading ? 'Updating…' : '🏁 Complete Trip'}
                </button>
              </div>
            </div>

            {/* GPS Telemetry Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                background: '#f8faff',
                padding: 14,
                borderRadius: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>GPS STATUS</div>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 3 }}>
                  {gpsStatus === 'tracking' ? (
                    <span style={{ color: '#16a34a' }}>🟢 Broadcasting GPS</span>
                  ) : gpsStatus === 'denied' ? (
                    <span style={{ color: '#dc2626' }}>🔴 Permission Denied</span>
                  ) : gpsStatus === 'error' ? (
                    <span style={{ color: '#dc2626' }}>🔴 GPS Error</span>
                  ) : (
                    <span style={{ color: '#64748b' }}>⚪ Idle (Not Tracking)</span>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>DEVICE LATITUDE</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>
                  {currentCoords ? currentCoords.latitude.toFixed(5) : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>DEVICE LONGITUDE</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>
                  {currentCoords ? currentCoords.longitude.toFixed(5) : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>GPS ACCURACY</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>
                  {currentCoords ? `±${Math.round(currentCoords.accuracy)}m` : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>LAST SENT</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>
                  {lastSentTime ? lastSentTime.toLocaleTimeString() : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* ── RedBus Stop Progression ── */}
          <div className="panel">
            <h3 style={{ marginBottom: 14, fontSize: 16 }}>Route Stops & Arrival Progress</h3>
            <RedBusJourneyTracker
              journey={{
                total_stops: tripData.stops.length,
                reached_stops_count: tripData.stops.filter((s) => s.isReached).length,
                remaining_stops_count: tripData.stops.filter((s) => !s.isReached).length,
                stops: tripData.stops,
              }}
              location={
                currentCoords
                  ? {
                      latitude: currentCoords.latitude,
                      longitude: currentCoords.longitude,
                      accuracy: currentCoords.accuracy,
                      recorded_at: lastSentTime,
                      is_stale: false,
                    }
                  : tripData.latestLocation
              }
              trip={tripData}
            />
          </div>

          {/* ── Student Transport Roster ── */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, margin: 0 }}>
                Students on this Trip ({students.length})
              </h3>
              <button
                type="button"
                className="table-action-button"
                onClick={() => loadStudents(tripData.id)}
                disabled={loadingStudents}
              >
                {loadingStudents ? 'Refreshing…' : '🔄 Refresh Roster'}
              </button>
            </div>

            {students.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 14 }}>
                No students currently enrolled on this trip.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Primary Contact</th>
                      <th>Assigned Stops</th>
                      <th>Current Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const statusColor =
                        student.transport_status === 'BOARDED' || student.transport_status === 'ON_BUS'
                          ? '#15803d'
                          : student.transport_status === 'DROPPED_OFF'
                          ? '#475569'
                          : student.transport_status === 'ABSENT'
                          ? '#dc2626'
                          : '#b45309';

                      const statusBg =
                        student.transport_status === 'BOARDED' || student.transport_status === 'ON_BUS'
                          ? '#dcfce7'
                          : student.transport_status === 'DROPPED_OFF'
                          ? '#f1f5f9'
                          : student.transport_status === 'ABSENT'
                          ? '#fee2e2'
                          : '#fef3c7';

                      return (
                        <tr key={student.student_id}>
                          <td>
                            <strong>{student.student_name}</strong>
                          </td>
                          <td>{student.student_class || '—'}</td>
                          <td>
                            {student.primary_parent_name || 'Parent'}
                            {student.primary_parent_phone && (
                              <div style={{ fontSize: 12 }}>
                                <a
                                  href={`tel:${student.primary_parent_phone}`}
                                  style={{ color: '#0284c7', textDecoration: 'none' }}
                                >
                                  📞 {student.primary_parent_phone}
                                </a>
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontSize: 12 }}>
                              <span style={{ color: '#16a34a', fontWeight: 600 }}>🚏 In:</span> {student.pickup_stop_name || 'Route Start'}
                            </div>
                            <div style={{ fontSize: 12, marginTop: 2 }}>
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>🏁 Out:</span> {student.dropoff_stop_name || 'Route End'}
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                color: statusColor,
                                background: statusBg,
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {student.transport_status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              {student.transport_status !== 'BOARDED' && (
                                <button
                                  type="button"
                                  className="table-action-button"
                                  style={{ color: '#16a34a', borderColor: '#86efac' }}
                                  onClick={() => handleUpdateStudentStatus(student.student_id, 'BOARDED')}
                                >
                                  Board
                                </button>
                              )}
                              {student.transport_status !== 'DROPPED_OFF' && (
                                <button
                                  type="button"
                                  className="table-action-button"
                                  style={{ color: '#0284c7', borderColor: '#bae6fd' }}
                                  onClick={() => handleUpdateStudentStatus(student.student_id, 'DROPPED_OFF')}
                                >
                                  Drop Off
                                </button>
                              )}
                              {student.transport_status !== 'ABSENT' && (
                                <button
                                  type="button"
                                  className="table-action-button"
                                  style={{ color: '#dc2626', borderColor: '#fecaca' }}
                                  onClick={() => handleUpdateStudentStatus(student.student_id, 'ABSENT')}
                                >
                                  Absent
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : scheduledTrip ? (
        /* ── Upcoming Scheduled Trip (Ready to Start) ── */
        <div className="panel" style={{ border: '2px solid #93c5fd', background: '#eff6ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <span className="badge-count" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                Upcoming Assigned Trip • {scheduledTrip.direction}
              </span>
              <h3 style={{ marginTop: 8, fontSize: 20, color: '#1e3a8a' }}>
                Trip #{scheduledTrip.id}: Bus {scheduledTrip.bus_number} — {scheduledTrip.route_name}
              </h3>
              <p style={{ color: '#475569', marginTop: 4 }}>
                Scheduled Start:{' '}
                <strong>
                  {scheduledTrip.scheduled_start_at
                    ? new Date(scheduledTrip.scheduled_start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Today'}
                </strong>{' '}
                • Route Code: <strong>{scheduledTrip.route_code}</strong> • Stops: <strong>{scheduledTrip.stops?.length || 0}</strong>
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              disabled={actionLoading}
              style={{
                background: '#16a34a',
                fontSize: 16,
                padding: '12px 24px',
                width: 'auto',
                margin: 0,
                opacity: actionLoading ? 0.6 : 1,
              }}
              onClick={() => handleStartTrip(scheduledTrip.id)}
            >
              {actionLoading ? 'Starting…' : '🚀 Start This Trip Now'}
            </button>
          </div>

          {scheduledTrip.stops && scheduledTrip.stops.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>
                ROUTE STOPS ({scheduledTrip.stops.length}):
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {scheduledTrip.stops.map((s, idx) => (
                  <span
                    key={s.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #bfdbfe',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 13,
                      color: '#1e293b',
                    }}
                  >
                    <strong>{idx + 1}.</strong> {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── No Active or Scheduled Trip ── */
        <div className="panel empty-state">
          <h3>No Active or Scheduled Trips</h3>
          <p style={{ marginTop: 8 }}>
            You do not currently have any active or upcoming trips assigned.
          </p>
          <p style={{ fontSize: 13, color: '#8fa0ba' }}>
            When a school administrator assigns a trip to you, it will appear here ready to start with live GPS tracking.
          </p>
        </div>
      )}
    </section>
  );
}
