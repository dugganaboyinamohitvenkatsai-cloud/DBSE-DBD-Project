import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

export function DriverStudentsPage() {
  const [activeTrip, setActiveTrip] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/driver/active-trip');
      const trip = res.activeTrip || res.scheduledTrip || null;
      setActiveTrip(trip);

      if (trip?.id) {
        const studRes = await apiRequest(`/driver/trips/${trip.id}/students`);
        setStudents(studRes.students || []);
      } else {
        setStudents([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load trip students.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleStatusChange(studentId, newStatus) {
    if (!activeTrip?.id) return;
    try {
      await apiRequest(`/admin/students/${studentId}/transport-status`, {
        method: 'PUT',
        body: JSON.stringify({
          trip_id: activeTrip.id,
          status: newStatus,
        }),
      });
      setSuccess(`Status updated to ${newStatus}.`);
      setTimeout(() => setSuccess(''), 3000);
      // Reload students
      const studRes = await apiRequest(`/driver/trips/${activeTrip.id}/students`);
      setStudents(studRes.students || []);
    } catch (err) {
      setError(`Failed to update status: ${err.message}`);
    }
  }

  return (
    <section>
      <div className="panel hero-panel" style={{ marginBottom: 18 }}>
        <p className="eyebrow">Driver Portal</p>
        <h2>Student Transport & Attendance</h2>
        <p>Record boarding and drop-off status for students assigned to your current trip.</p>
      </div>

      {error && (
        <div className="alert-box alert-box--warning" style={{ marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="alert-box alert-box--success" style={{ marginBottom: 16 }}>
          ✅ {success}
        </div>
      )}

      {loading ? (
        <div className="page-state" style={{ minHeight: 180 }}>Loading student roster…</div>
      ) : !activeTrip ? (
        <div className="panel empty-state">
          <h3>No Active or Scheduled Trip</h3>
          <p style={{ marginTop: 8 }}>
            You need an active or scheduled trip to view and manage student boarding.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Trip Summary Card */}
          <div className="panel" style={{ background: '#f8faff', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span className="badge-count" style={{ background: '#ede9fe', color: '#5b21b6' }}>
                  Trip #{activeTrip.id} • {activeTrip.direction}
                </span>
                <h3 style={{ marginTop: 6, fontSize: 18 }}>
                  Bus {activeTrip.bus_number} — {activeTrip.route_name}
                </h3>
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: activeTrip.status === 'IN_PROGRESS' ? '#dcfce7' : '#dbeafe',
                  color: activeTrip.status === 'IN_PROGRESS' ? '#15803d' : '#1d4ed8',
                }}
              >
                ● {activeTrip.status}
              </span>
            </div>
          </div>

          {/* Students Roster */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 16, margin: 0 }}>
                Enrolled Students ({students.length})
              </h3>
              <button
                type="button"
                className="table-action-button"
                onClick={loadData}
              >
                🔄 Refresh Roster
              </button>
            </div>

            {students.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: 14 }}>
                No students are currently linked to this trip.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Class</th>
                      <th>Primary Contact</th>
                      <th>Assigned Stops</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st) => {
                      const isBoarded = st.transport_status === 'BOARDED' || st.transport_status === 'ON_BUS';
                      const isDroppedOff = st.transport_status === 'DROPPED_OFF';
                      const isAbsent = st.transport_status === 'ABSENT';

                      const statusColor = isBoarded ? '#15803d' : isDroppedOff ? '#475569' : isAbsent ? '#dc2626' : '#b45309';
                      const statusBg = isBoarded ? '#dcfce7' : isDroppedOff ? '#f1f5f9' : isAbsent ? '#fee2e2' : '#fef3c7';

                      return (
                        <tr key={st.student_id}>
                          <td>
                            <strong>{st.student_name}</strong>
                          </td>
                          <td>{st.student_class || '—'}</td>
                          <td>
                            {st.primary_parent_name || 'Parent'}
                            {st.primary_parent_phone && (
                              <div style={{ fontSize: 12 }}>
                                <a
                                  href={`tel:${st.primary_parent_phone}`}
                                  style={{ color: '#0284c7', textDecoration: 'none' }}
                                >
                                  📞 {st.primary_parent_phone}
                                </a>
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontSize: 13 }}>
                              <span style={{ color: '#16a34a', fontWeight: 600 }}>🚏 In:</span> {st.pickup_stop_name || 'Route Start'}
                            </div>
                            <div style={{ fontSize: 13, marginTop: 2 }}>
                              <span style={{ color: '#dc2626', fontWeight: 600 }}>🏁 Out:</span> {st.dropoff_stop_name || 'Route End'}
                            </div>
                          </td>
                          <td>
                            <span
                              style={{
                                color: statusColor,
                                background: statusBg,
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {st.transport_status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="table-action-button"
                                style={{
                                  color: isBoarded ? '#15803d' : '#16a34a',
                                  borderColor: isBoarded ? '#15803d' : '#86efac',
                                  background: isBoarded ? '#dcfce7' : 'transparent',
                                  fontWeight: isBoarded ? 800 : 500,
                                }}
                                onClick={() => handleStatusChange(st.student_id, 'BOARDED')}
                              >
                                {isBoarded ? '✓ Boarded' : 'Board'}
                              </button>

                              <button
                                type="button"
                                className="table-action-button"
                                style={{
                                  color: isDroppedOff ? '#1e293b' : '#0284c7',
                                  borderColor: isDroppedOff ? '#64748b' : '#bae6fd',
                                  background: isDroppedOff ? '#f1f5f9' : 'transparent',
                                  fontWeight: isDroppedOff ? 800 : 500,
                                }}
                                onClick={() => handleStatusChange(st.student_id, 'DROPPED_OFF')}
                              >
                                {isDroppedOff ? '✓ Dropped Off' : 'Drop Off'}
                              </button>

                              <button
                                type="button"
                                className="table-action-button"
                                style={{
                                  color: isAbsent ? '#b91c1c' : '#dc2626',
                                  borderColor: isAbsent ? '#f87171' : '#fecaca',
                                  background: isAbsent ? '#fee2e2' : 'transparent',
                                  fontWeight: isAbsent ? 800 : 500,
                                }}
                                onClick={() => handleStatusChange(st.student_id, 'ABSENT')}
                              >
                                {isAbsent ? '✓ Absent' : 'Absent'}
                              </button>
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
      )}
    </section>
  );
}
