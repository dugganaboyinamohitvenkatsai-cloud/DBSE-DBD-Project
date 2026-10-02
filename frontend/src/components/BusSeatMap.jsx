import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiRequest } from '../lib/api';
import {
  Armchair,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Search,
  X,
  UserMinus,
  UserPlus,
  Bus,
  ShieldCheck,
} from 'lucide-react';

export function BusSeatMap({ tripId, onUpdated }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [seatData, setSeatData] = useState(null);

  const [selectedSeat, setSelectedSeat] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Student assignment state
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  const loadSeats = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/admin/trips/${tripId}/seats`);
      setSeatData(data);
      // If a seat was selected, refresh its reference
      if (selectedSeat) {
        const refreshedSeat = (data.layout || []).find(
          (s) => s.seat_number === selectedSeat.seat_number
        );
        setSelectedSeat(refreshedSeat || null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load seat layout.');
    } finally {
      setLoading(false);
    }
  }, [tripId, selectedSeat?.seat_number]);

  useEffect(() => {
    setSelectedSeat(null);
    setSelectedStudentId('');
    setStudentSearch('');
    setSuccess('');
    setError('');
    loadSeats();
  }, [tripId]);

  // Filter students for assignment dropdown (showing unassigned first)
  const filteredStudents = useMemo(() => {
    if (!seatData?.students) return [];
    const assignedIds = new Set(
      (seatData.assignments || []).map((a) => a.student_id)
    );

    return seatData.students
      .filter((s) => {
        if (!studentSearch.trim()) return true;
        const q = studentSearch.toLowerCase();
        return (
          s.name?.toLowerCase().includes(q) ||
          s.class?.toLowerCase().includes(q) ||
          s.parent_phone?.includes(q) ||
          String(s.student_id).includes(q)
        );
      })
      .map((s) => ({
        ...s,
        is_already_assigned: assignedIds.has(s.student_id),
      }));
  }, [seatData, studentSearch]);

  async function handleAssign(e) {
    e.preventDefault();
    if (!selectedSeat || !selectedStudentId) return;
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/admin/trips/${tripId}/seats`, {
        method: 'POST',
        body: JSON.stringify({
          seat_number: selectedSeat.seat_number,
          student_id: Number(selectedStudentId),
        }),
      });

      setSuccess(`Seat #${selectedSeat.seat_number} allocated successfully.`);
      setSelectedStudentId('');
      setStudentSearch('');
      await loadSeats();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to allocate seat.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnassign(seatNumber) {
    if (!seatNumber) return;
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/admin/trips/${tripId}/seats/${seatNumber}`, {
        method: 'DELETE',
      });

      setSuccess(`Seat #${seatNumber} is now vacant.`);
      await loadSeats();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Failed to unassign seat.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12 }}>
        <Loader2 size={32} className="sb-spin" style={{ color: 'var(--sb-primary-600, #2563eb)' }} />
        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Loading bus seat configuration…</span>
      </div>
    );
  }

  if (!seatData) {
    return (
      <div className="alert-box alert-box--danger">
        <AlertCircle size={16} />
        <span>{error || 'Unable to load trip seat data.'}</span>
      </div>
    );
  }

  const { trip, total_capacity, occupied_count, available_count, layout = [] } = seatData;

  // Group seats into rows of 4 (2 on left, aisle, 2 on right)
  const rows = [];
  for (let i = 0; i < layout.length; i += 4) {
    rows.push(layout.slice(i, i + 4));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Status & Notification Bar ── */}
      {success && (
        <div className="alert-box alert-box--success" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="alert-box alert-box--danger" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Trip & Fleet Capacity Stats Header ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Assigned Vehicle
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
            <Bus size={16} style={{ color: '#2563eb' }} />
            <span>{trip.bus_number}</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>
            {trip.registration_number}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Transit Corridor
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginTop: 4 }}>
            {trip.route_name}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Driver: <strong>{trip.driver_name || 'Assigned Driver'}</strong>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Capacity
          </div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#0f172a', marginTop: 2 }}>
            {total_capacity} <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Seats</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 12 }}>
            <span style={{ color: '#16a34a', fontWeight: 700 }}>{occupied_count} Allocated</span>
            <span>•</span>
            <span style={{ color: '#2563eb', fontWeight: 700 }}>{available_count} Available</span>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Visual Bus Map + Action Details Pane ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1.4fr) minmax(260px, 1fr)', gap: 20, alignItems: 'start' }}>
        
        {/* Visual Bus Cabin Layout */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            border: '2px solid #cbd5e1',
            padding: '20px 16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            position: 'relative',
          }}
        >
          {/* Bus Front / Windshield / Cabin Area */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f1f5f9',
              borderRadius: '12px 12px 4px 4px',
              padding: '10px 16px',
              marginBottom: 16,
              borderBottom: '2px solid #cbd5e1',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#475569' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e' }} />
              FRONT • ENTRY DOOR
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: '#e2e8f0',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 800,
                color: '#334155',
              }}
            >
              <span>STEERING / DRIVER</span>
            </div>
          </div>

          {/* Seat Grid Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
            {rows.map((row, rIdx) => {
              const leftSeats = row.slice(0, 2);
              const rightSeats = row.slice(2, 4);

              return (
                <div
                  key={rIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    backgroundColor: rIdx % 2 === 0 ? '#f8fafc' : 'transparent',
                    borderRadius: 8,
                  }}
                >
                  {/* Left Pair */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {leftSeats.map((seat) => {
                      const isSelected = selectedSeat?.seat_number === seat.seat_number;
                      return (
                        <SeatButton
                          key={seat.seat_number}
                          seat={seat}
                          isSelected={isSelected}
                          onClick={() => setSelectedSeat(seat)}
                        />
                      );
                    })}
                  </div>

                  {/* Aisle */}
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', userSelect: 'none' }}>
                    AISLE {rIdx + 1}
                  </div>

                  {/* Right Pair */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {rightSeats.map((seat) => {
                      const isSelected = selectedSeat?.seat_number === seat.seat_number;
                      return (
                        <SeatButton
                          key={seat.seat_number}
                          seat={seat}
                          isSelected={isSelected}
                          onClick={() => setSelectedSeat(seat)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 16,
              marginTop: 18,
              paddingTop: 12,
              borderTop: '1px solid #e2e8f0',
              fontSize: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1' }} />
              <span style={{ color: '#64748b' }}>Vacant</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#dcfce7', border: '1.5px solid #16a34a' }} />
              <span style={{ color: '#15803d', fontWeight: 600 }}>Allocated</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#eff6ff', border: '2px solid #2563eb' }} />
              <span style={{ color: '#1d4ed8', fontWeight: 700 }}>Selected</span>
            </div>
          </div>
        </div>

        {/* ── Side Action Drawer: Seat Details / Allocation ── */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            padding: '18px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          }}
        >
          {selectedSeat ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: selectedSeat.is_occupied ? '#dcfce7' : '#eff6ff',
                      color: selectedSeat.is_occupied ? '#15803d' : '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  >
                    {selectedSeat.seat_number}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Seat #{selectedSeat.seat_number}
                    </h3>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: selectedSeat.is_occupied ? '#16a34a' : '#2563eb',
                      }}
                    >
                      {selectedSeat.is_occupied ? '● Currently Allocated' : '○ Vacant / Ready to Assign'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSeat(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  <X size={16} />
                </button>
              </div>

              {selectedSeat.is_occupied ? (
                /* Occupied Seat Card */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: 10,
                      padding: '12px 14px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <User size={15} style={{ color: '#2563eb' }} />
                      <strong style={{ fontSize: 14, color: '#0f172a' }}>
                        {selectedSeat.assignment.student_name}
                      </strong>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div>Class: <strong>{selectedSeat.assignment.student_class || 'Standard'}</strong></div>
                      <div>Contact: <strong>{selectedSeat.assignment.parent_phone || 'N/A'}</strong></div>
                      {selectedSeat.assignment.pickup_stop_name && (
                        <div>Pickup Stop: <strong>{selectedSeat.assignment.pickup_stop_name}</strong></div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => handleUnassign(selectedSeat.seat_number)}
                    disabled={actionLoading}
                    style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {actionLoading ? (
                      <Loader2 size={14} className="sb-spin" />
                    ) : (
                      <UserMinus size={14} />
                    )}
                    <span>Unassign Student from Seat</span>
                  </button>
                </div>
              ) : (
                /* Vacant Seat: Assign Student Form */
                <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label className="field-label" style={{ margin: 0 }}>
                    Allocate to Student:
                  </label>

                  {/* Search Student filter */}
                  <div style={{ position: 'relative' }}>
                    <input
                      className="text-input"
                      type="text"
                      placeholder="Search student by name / class / phone..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      style={{ paddingLeft: 30, fontSize: 12.5 }}
                    />
                    <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  </div>

                  {/* Student Select dropdown */}
                  <select
                    className="text-input"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    required
                    style={{ fontSize: 12.5 }}
                  >
                    <option value="">-- Choose Student ({filteredStudents.length} available) --</option>
                    {filteredStudents.map((s) => (
                      <option
                        key={s.student_id}
                        value={s.student_id}
                        disabled={s.is_already_assigned}
                      >
                        {s.name} ({s.class || 'Std'}) {s.is_already_assigned ? '— [Already Assigned]' : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={actionLoading || !selectedStudentId}
                    style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {actionLoading ? (
                      <Loader2 size={14} className="sb-spin" />
                    ) : (
                      <UserPlus size={14} />
                    )}
                    <span>Assign to Seat #{selectedSeat.seat_number}</span>
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
              <Armchair size={36} style={{ color: '#cbd5e1', margin: '0 auto 10px' }} />
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>
                Select a Seat to Inspect
              </h4>
              <p style={{ fontSize: 12, margin: 0 }}>
                Click any seat in the bus layout to assign a student or release an existing assignment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SeatButton({ seat, isSelected, onClick }) {
  const isOccupied = seat.is_occupied;
  const seatNum = seat.seat_number;
  const student = seat.assignment?.student_name;

  let bg = '#ffffff';
  let border = '1.5px solid #cbd5e1';
  let textColor = '#475569';

  if (isOccupied) {
    bg = '#dcfce7';
    border = '1.5px solid #16a34a';
    textColor = '#15803d';
  }

  if (isSelected) {
    bg = '#eff6ff';
    border = '2px solid #2563eb';
    textColor = '#1d4ed8';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: bg,
        border,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: isSelected ? '0 0 0 3px rgba(37, 99, 235, 0.2)' : '0 1px 2px rgba(0, 0, 0, 0.05)',
        position: 'relative',
      }}
      title={isOccupied ? `Seat #${seatNum}: Assigned to ${student}` : `Seat #${seatNum}: Vacant`}
    >
      <Armchair size={16} color={textColor} />
      <span style={{ fontSize: 10, fontWeight: 800, color: textColor, marginTop: 1 }}>
        {seatNum}
      </span>
    </button>
  );
}
