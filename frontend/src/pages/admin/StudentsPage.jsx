import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import {
  GraduationCap,
  Search,
  Plus,
  Phone,
  Bus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────── */
const EMPTY_FORM = { name: '', class: '', parent_phone: '' };

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function getStatusBadgeStyle(status) {
  switch (status) {
    case 'ON_BUS':
    case 'BOARDED':
      return {
        bg: 'var(--sb-success-bg)',
        color: 'var(--sb-success-text)',
        border: 'var(--sb-success-border)',
        label: status === 'ON_BUS' ? 'On Board Bus' : 'Boarded',
      };
    case 'DROPPED_OFF':
      return {
        bg: 'var(--sb-surface-muted)',
        color: 'var(--sb-text-title)',
        border: 'var(--sb-border)',
        label: 'Dropped Off',
      };
    case 'WAITING':
      return {
        bg: 'var(--sb-warning-bg)',
        color: 'var(--sb-warning-text)',
        border: 'var(--sb-warning-border)',
        label: 'Awaiting Boarding',
      };
    case 'ABSENT':
      return {
        bg: 'var(--sb-danger-bg)',
        color: 'var(--sb-danger-text)',
        border: 'var(--sb-danger-border)',
        label: 'Marked Absent',
      };
    default:
      return {
        bg: 'var(--sb-surface-subtle)',
        color: 'var(--sb-text-muted)',
        border: 'var(--sb-border)',
        label: 'Unassigned',
      };
  }
}

/* ─── Add / Edit Student Modal ────────────────────────────── */
function StudentModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(initial?.student_id);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const path = isEdit
        ? `/admin/students/${initial.student_id}`
        : '/admin/students';
      const method = isEdit ? 'PUT' : 'POST';
      const { student } = await apiRequest(path, {
        method,
        body: JSON.stringify(form),
      });
      onSave(student);
    } catch (err) {
      setError(err.message || 'Failed to save student record.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 480, padding: 28 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>
              {isEdit ? 'Update Directory Record' : 'New Enrollment'}
            </span>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--sb-text-title)', marginTop: 2 }}>
              {isEdit ? `Edit ${initial.name}` : 'Register Student'}
            </h3>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close"
            style={{ color: 'var(--sb-text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert-box alert-box--danger" style={{ marginBottom: 16 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="field-label">
              Full Student Name *
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                required
                autoFocus
                placeholder="e.g. Rahul Sharma"
                style={{ marginTop: 4 }}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="field-label">
                Class / Grade *
                <input
                  type="text"
                  value={form.class}
                  onChange={set('class')}
                  placeholder="e.g. 8A"
                  required
                  style={{ marginTop: 4 }}
                />
              </label>

              <label className="field-label">
                Primary Parent Phone
                <input
                  type="tel"
                  value={form.parent_phone || ''}
                  onChange={set('parent_phone')}
                  placeholder="e.g. 9876543210"
                  style={{ marginTop: 4 }}
                />
              </label>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: 24 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary-button modal-submit" disabled={saving || !form.name.trim()}>
              {saving ? (
                <>
                  <Loader2 size={15} className="sb-spin" />
                  <span>Saving…</span>
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Register Student'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Delete Confirmation Modal ─────────────────────────── */
function ConfirmDelete({ student, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setDeleting(true);
    setError('');
    try {
      await apiRequest(`/admin/students/${student.student_id}`, { method: 'DELETE' });
      onConfirm(student.student_id);
    } catch (err) {
      setError(err.message || 'Failed to remove student record.');
      setDeleting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 440, padding: 26 }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--sb-radius-full)',
              background: 'var(--sb-danger-bg)',
              color: 'var(--sb-danger-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Trash2 size={20} />
          </div>

          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--sb-text-title)', margin: 0 }}>
              Remove {student.name}?
            </h3>
            <p style={{ color: 'var(--sb-text-muted)', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
              This will permanently delete this student’s profile, active route assignments, and family guardianship links.
            </p>
          </div>
        </div>

        {error && (
          <div className="alert-box alert-box--danger" style={{ marginTop: 14 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: 22 }}>
          <button className="btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button className="btn-danger" onClick={confirm} disabled={deleting}>
            {deleting ? 'Removing…' : 'Confirm Removal'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Assign Transport Modal ────────────────────────────── */
function AssignTransportModal({ student, onSave, onClose }) {
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [selectedTripId, setSelectedTripId] = useState('');

  const [routeStops, setRouteStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);

  const [pickupStopId, setPickupStopId] = useState('');
  const [dropoffStopId, setDropoffStopId] = useState('');
  const [status, setStatus] = useState('WAITING');
  const [notes, setNotes] = useState('');

  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadInitial() {
      try {
        setLoadingTrips(true);
        setError('');
        const [tripsData, statusData] = await Promise.all([
          apiRequest('/admin/trips?limit=50'),
          apiRequest(`/admin/students/${student.student_id}/transport-status`).catch(() => null),
        ]);

        if (!isMounted) return;

        const tripList = tripsData.trips || [];
        setTrips(tripList);

        const existing = statusData?.assignment;
        if (existing) {
          setCurrentAssignment(existing);
          setSelectedTripId(String(existing.trip_id));
          setStatus(existing.status || 'WAITING');
          setNotes(existing.notes || '');
        } else if (tripList.length > 0) {
          const activeTrip = tripList.find((t) => ['IN_PROGRESS', 'STARTED', 'SCHEDULED'].includes(t.status)) || tripList[0];
          setSelectedTripId(String(activeTrip.id));
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load trip schedules.');
      } finally {
        if (isMounted) setLoadingTrips(false);
      }
    }
    loadInitial();
    return () => { isMounted = false; };
  }, [student.student_id]);

  useEffect(() => {
    if (!selectedTripId) {
      return;
    }

    const tripObj = trips.find((t) => String(t.id) === String(selectedTripId));
    if (!tripObj || !tripObj.route_id) return;

    let isMounted = true;
    async function loadStops() {
      try {
        setLoadingStops(true);
        setError('');
        const data = await apiRequest(`/admin/routes/${tripObj.route_id}/stops`);
        if (!isMounted) return;

        const stops = (data.stops || []).sort((a, b) => a.stop_order - b.stop_order);
        setRouteStops(stops);

        if (currentAssignment && String(currentAssignment.trip_id) === String(selectedTripId)) {
          setPickupStopId(currentAssignment.pickup_stop_id ? String(currentAssignment.pickup_stop_id) : (stops[0]?.id ? String(stops[0].id) : ''));
          setDropoffStopId(currentAssignment.dropoff_stop_id ? String(currentAssignment.dropoff_stop_id) : (stops[stops.length - 1]?.id ? String(stops[stops.length - 1].id) : ''));
        } else {
          if (stops.length > 0) {
            setPickupStopId(String(stops[0].id));
            setDropoffStopId(stops.length > 1 ? String(stops[stops.length - 1].id) : String(stops[0].id));
          } else {
            setPickupStopId('');
            setDropoffStopId('');
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load corridor stops.');
      } finally {
        if (isMounted) setLoadingStops(false);
      }
    }

    loadStops();
    return () => { isMounted = false; };
  }, [selectedTripId, trips, currentAssignment]);

  const selectedTrip = trips.find((t) => String(t.id) === String(selectedTripId));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedTripId) {
      setError('Please select a transportation run.');
      return;
    }

    if (!pickupStopId || !dropoffStopId) {
      setError('Please select both a pickup and dropoff stop.');
      return;
    }

    const pStop = routeStops.find((s) => String(s.id) === String(pickupStopId));
    const dStop = routeStops.find((s) => String(s.id) === String(dropoffStopId));

    if (pStop && dStop && pStop.stop_order >= dStop.stop_order) {
      setError(
        `Pickup milestone "${pStop.name}" (#${pStop.stop_order}) must occur before dropoff milestone "${dStop.name}" (#${dStop.stop_order}).`
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        trip_id: parseInt(selectedTripId, 10),
        pickup_stop_id: parseInt(pickupStopId, 10),
        dropoff_stop_id: parseInt(dropoffStopId, 10),
        status,
        notes: notes.trim() || null,
      };

      const res = await apiRequest(`/admin/students/${student.student_id}/transport-status`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setSuccess(`Assigned ${student.name} to Trip #${selectedTripId}`);
      setTimeout(() => {
        onSave(res);
      }, 500);
    } catch (err) {
      setError(err.message || 'Failed to assign transport.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 540, padding: 28 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>Corridor Dispatch</span>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--sb-text-title)', marginTop: 2 }}>
              Assign Transportation Trip
            </h3>
            <p style={{ color: 'var(--sb-text-muted)', fontSize: 13, marginTop: 2 }}>
              Student: <strong>{student.name}</strong> • Class {student.class || 'N/A'} (ID #{student.student_id})
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="alert-box alert-box--danger" style={{ marginBottom: 14 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert-box alert-box--success" style={{ marginBottom: 14 }}>
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        {loadingTrips ? (
          <div className="page-state" style={{ minHeight: 200 }}>
            <Loader2 size={20} className="sb-spin" />
            <span>Loading scheduled trips…</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Trip Selection */}
              <label className="field-label">
                Scheduled Transit Run *
                <select
                  className="select-input"
                  value={selectedTripId}
                  onChange={(e) => setSelectedTripId(e.target.value)}
                  required
                  style={{ marginTop: 4 }}
                >
                  <option value="">-- Choose a Scheduled Trip --</option>
                  {trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      Trip #{t.id} — {t.route_name || t.route_code} ({t.direction}) | Bus {t.bus_number || 'N/A'} [{t.status}]
                    </option>
                  ))}
                </select>
              </label>

              {/* Selected Trip Details Ribbon */}
              {selectedTrip && (
                <div
                  style={{
                    backgroundColor: 'var(--sb-surface-muted)',
                    border: '1px solid var(--sb-border)',
                    borderRadius: 'var(--sb-radius-sm)',
                    padding: '10px 14px',
                    fontSize: 12.5,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--sb-text-title)' }}>
                      {selectedTrip.route_name}
                    </span>
                    <span
                      className="badge-status"
                      style={{
                        backgroundColor: selectedTrip.status === 'IN_PROGRESS' ? 'var(--sb-success-bg)' : 'var(--sb-surface)',
                        color: selectedTrip.status === 'IN_PROGRESS' ? 'var(--sb-success-text)' : 'var(--sb-text-muted)',
                      }}
                    >
                      {selectedTrip.status}
                    </span>
                  </div>
                  <div style={{ color: 'var(--sb-text-muted)', fontSize: 11.5, marginTop: 4 }}>
                    Bus: <strong>{selectedTrip.bus_number || 'N/A'}</strong> • Driver: {selectedTrip.driver_name || 'Assigned Driver'} • {selectedTrip.direction === 'PICKUP' ? 'Morning Pickup' : 'Evening Dropoff'}
                  </div>
                </div>
              )}

              {/* Waypoint Stops Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field-label">
                  Designated Pickup Stop *
                  <select
                    className="select-input"
                    value={pickupStopId}
                    onChange={(e) => setPickupStopId(e.target.value)}
                    disabled={loadingStops || routeStops.length === 0}
                    required
                    style={{ marginTop: 4 }}
                  >
                    <option value="">
                      {loadingStops ? 'Loading stops…' : routeStops.length === 0 ? '-- No stops found --' : '-- Pickup Stop --'}
                    </option>
                    {routeStops.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.stop_order} — {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-label">
                  Designated Dropoff Stop *
                  <select
                    className="select-input"
                    value={dropoffStopId}
                    onChange={(e) => setDropoffStopId(e.target.value)}
                    disabled={loadingStops || routeStops.length === 0}
                    required
                    style={{ marginTop: 4 }}
                  >
                    <option value="">
                      {loadingStops ? 'Loading stops…' : routeStops.length === 0 ? '-- No stops found --' : '-- Dropoff Stop --'}
                    </option>
                    {routeStops.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.stop_order} — {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Status and Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="field-label">
                  Initial Transit Status
                  <select
                    className="select-input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{ marginTop: 4 }}
                  >
                    <option value="WAITING">WAITING (Awaiting)</option>
                    <option value="BOARDED">BOARDED (Scanned)</option>
                    <option value="ON_BUS">ON_BUS (In Transit)</option>
                    <option value="DROPPED_OFF">DROPPED_OFF (Arrived)</option>
                    <option value="ABSENT">ABSENT</option>
                  </select>
                </label>

                <label className="field-label">
                  Special Notes
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Needs front row seating"
                    style={{ marginTop: 4 }}
                  />
                </label>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 22 }}>
              <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button modal-submit"
                disabled={saving || loadingStops || routeStops.length === 0}
              >
                {saving ? 'Saving…' : 'Save Assignment'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─── Main Students Directory Page ────────────────────────── */
export function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [transportTarget, setTransportTarget] = useState(null);

  const debouncedSearch = useDebounce(search);
  const limit = 20;

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const data = await apiRequest(`/admin/students?${params}`);
      setStudents(data.students || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch student records.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  const prevSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (prevSearch.current !== debouncedSearch) {
      prevSearch.current = debouncedSearch;
      setPage(1);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  function handleSaved() {
    setModal(null);
    setTransportTarget(null);
    fetchStudents();
  }

  function handleDeleted() {
    setDeleteTarget(null);
    fetchStudents();
  }

  const firstRow = (page - 1) * limit + 1;
  const lastRow = Math.min(page * limit, total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. Page Header (Open Architectural Composition) ── */}
      <div className="sb-page-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ margin: 0, wordBreak: 'break-word' }}>Student Intelligence & People Management</span>
            <span style={{ color: 'var(--sb-border-strong)' }}>•</span>
            <span style={{ fontSize: 12, color: 'var(--sb-text-muted)' }}>Institutional Roster</span>
          </div>
          <h2 style={{ fontSize: 24, letterSpacing: '-0.025em', color: 'var(--sb-primary-950)', margin: 0, fontWeight: 800 }}>
            Student Enrollment Directory
          </h2>
          <p style={{ marginTop: 4, fontSize: 13.5, color: 'var(--sb-text-muted)' }}>
            Student identity records, authorized family guardians, and transit corridor assignments.
          </p>
        </div>

        {/* Action Button & Active Counter */}
        <div className="sb-header-actions">
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--sb-radius-full)',
              background: 'var(--sb-surface)',
              border: '1px solid var(--sb-border)',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--sb-text-title)',
              boxShadow: 'var(--sb-shadow-xs)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <GraduationCap size={15} style={{ color: 'var(--sb-primary-600)' }} />
            <span>{total} Enrolled Student{total === 1 ? '' : 's'}</span>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => setModal({ mode: 'add' })}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            <Plus size={15} />
            <span>Register Student</span>
          </button>
        </div>
      </div>

      {/* ── 2. Filter & Search Toolbar ── */}
      <div className="sb-toolbar-panel">
        <div className="sb-toolbar-search-wrap">
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--sb-text-subtle)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, class, or phone…"
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              fontSize: 13,
              borderRadius: 'var(--sb-radius-sm)',
              border: '1px solid var(--sb-border)',
              outline: 'none',
              background: 'var(--sb-surface-muted)',
            }}
          />
        </div>

        <div style={{ fontSize: 12, color: 'var(--sb-text-muted)' }}>
          Showing {total > 0 ? `${firstRow}–${lastRow} of ${total}` : '0'} records
        </div>
      </div>

      {error && (
        <div className="alert-box alert-box--danger">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── 3. Table / Directory Presentation ── */}
      {loading ? (
        <div className="page-state" style={{ minHeight: 280 }}>
          <Loader2 size={24} className="sb-spin" style={{ color: 'var(--sb-primary-600)' }} />
          <span>Loading student directory…</span>
        </div>
      ) : students.length === 0 ? (
        <div className="empty-state" style={{ padding: 48 }}>
          <GraduationCap size={40} style={{ color: 'var(--sb-text-subtle)', marginBottom: 12 }} />
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--sb-text-title)' }}>No Students Found</h3>
          <p style={{ color: 'var(--sb-text-muted)', fontSize: 13, maxWidth: 400, margin: '6px auto 16px' }}>
            {debouncedSearch
              ? `No students matched your search for "${debouncedSearch}".`
              : 'No students have been enrolled in the directory yet.'}
          </p>
          {!debouncedSearch && (
            <button
              type="button"
              className="primary-button"
              onClick={() => setModal({ mode: 'add' })}
              style={{ width: 'auto' }}
            >
              <Plus size={15} />
              <span>Register First Student</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hide-mobile" style={{ background: 'var(--sb-surface)', border: '1px solid var(--sb-border)', borderRadius: 'var(--sb-radius-md)', overflow: 'hidden', boxShadow: 'var(--sb-shadow-xs)' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Student & Identity</th>
                  <th>Grade</th>
                  <th>Guardians & Family</th>
                  <th>Assigned Transit Run</th>
                  <th>Waypoints (Pickup → Dropoff)</th>
                  <th style={{ textAlign: 'right', width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const badge = getStatusBadgeStyle(s.transport_status);
                  const hasTrip = Boolean(s.current_trip_id);

                  return (
                    <tr key={s.student_id}>
                      {/* ID */}
                      <td style={{ fontFamily: 'var(--sb-font-mono)', fontSize: 12, color: 'var(--sb-text-subtle)' }}>
                        #{s.student_id}
                      </td>

                      {/* Student Identity */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 'var(--sb-radius-full)',
                              background: 'var(--sb-primary-50)',
                              color: 'var(--sb-primary-700)',
                              fontWeight: 800,
                              fontSize: 12.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid var(--sb-primary-100)',
                              flexShrink: 0,
                            }}
                          >
                            {s.name ? s.name.charAt(0) : 'S'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--sb-text-title)' }}>
                              {s.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--sb-text-subtle)' }}>
                              Enrolled Rider
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 'var(--sb-radius-sm)',
                            background: 'var(--sb-surface-muted)',
                            border: '1px solid var(--sb-border)',
                            fontWeight: 700,
                            fontSize: 11.5,
                            color: 'var(--sb-text-body)',
                          }}
                        >
                          Class {s.class || '—'}
                        </span>
                      </td>

                      {/* Guardians */}
                      <td>
                        {s.linked_parents ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--sb-text-title)' }}>
                              {s.linked_parents}
                            </div>
                            {s.parent_phone && (
                              <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                                <Phone size={10} />
                                <span>{s.parent_phone}</span>
                              </div>
                            )}
                          </div>
                        ) : s.parent_phone ? (
                          <div style={{ fontSize: 12, color: 'var(--sb-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={11} />
                            <span>{s.parent_phone}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--sb-text-subtle)', fontStyle: 'italic', fontSize: 11.5 }}>
                            No guardian linked
                          </span>
                        )}
                      </td>

                      {/* Transport Corridor */}
                      <td>
                        {hasTrip ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: 'var(--sb-primary-50)',
                                  color: 'var(--sb-primary-700)',
                                  fontWeight: 700,
                                  fontSize: 11,
                                  border: '1px solid var(--sb-primary-100)',
                                }}
                              >
                                Trip #{s.current_trip_id}
                              </span>
                              <span
                                className="badge-status"
                                style={{
                                  backgroundColor: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.border}`,
                                  padding: '2px 8px',
                                  fontSize: 11,
                                }}
                              >
                                {badge.label}
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)', marginTop: 2 }}>
                              {s.current_bus_number ? `Bus: ${s.current_bus_number}` : ''} {s.current_route_name ? `• ${s.current_route_name}` : ''}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--sb-text-subtle)', fontStyle: 'italic', fontSize: 12 }}>
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Waypoints */}
                      <td>
                        {s.pickup_stop_name || s.dropoff_stop_name ? (
                          <div style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--sb-success)', fontWeight: 800 }}>●</span>
                              <span style={{ fontWeight: 600, color: 'var(--sb-text-title)' }}>
                                {s.pickup_stop_name || 'Pickup Stop'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: 'var(--sb-danger)', fontWeight: 800 }}>●</span>
                              <span style={{ color: 'var(--sb-text-muted)' }}>
                                {s.dropoff_stop_name || 'Destination Stop'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--sb-text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setTransportTarget(s)}
                            title="Assign Trip & Stops"
                            style={{ padding: '5px 9px', fontSize: 12 }}
                          >
                            <Bus size={13} style={{ color: 'var(--sb-primary-600)' }} />
                            <span>Transport</span>
                          </button>

                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => setModal({ mode: 'edit', student: s })}
                            title="Edit Record"
                            style={{ padding: '5px 8px' }}
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => setDeleteTarget(s)}
                            title="Delete Student"
                            style={{ padding: '5px 8px', color: 'var(--sb-danger)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Intentional Card Representation (Visible only on <= 768px) */}
          <div className="hide-desktop" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {students.map((s) => {
              const badge = getStatusBadgeStyle(s.transport_status);
              const hasTrip = Boolean(s.current_trip_id);

              return (
                <div
                  key={s.student_id}
                  style={{
                    backgroundColor: 'var(--sb-surface)',
                    border: '1px solid var(--sb-border)',
                    borderRadius: 'var(--sb-radius-md)',
                    padding: '16px',
                    boxShadow: 'var(--sb-shadow-xs)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  {/* Card Header: Avatar, Name, Class & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 'var(--sb-radius-full)',
                          background: 'var(--sb-primary-50)',
                          color: 'var(--sb-primary-700)',
                          fontWeight: 800,
                          fontSize: 13.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--sb-primary-100)',
                          flexShrink: 0,
                        }}
                      >
                        {s.name ? s.name.charAt(0) : 'S'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 14.5,
                            fontWeight: 800,
                            color: 'var(--sb-text-title)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {s.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)' }}>
                          Class {s.class || '—'} • #{s.student_id}
                        </div>
                      </div>
                    </div>

                    <span
                      className="badge-status"
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        fontSize: 10.5,
                        padding: '3px 8px',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* Guardian & Transit Info */}
                  <div
                    style={{
                      backgroundColor: 'var(--sb-surface-muted)',
                      borderRadius: 'var(--sb-radius-sm)',
                      padding: '10px 12px',
                      fontSize: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--sb-text-subtle)' }}>Guardian:</span>
                      <span style={{ fontWeight: 600, color: 'var(--sb-text-title)' }}>
                        {s.linked_parents || s.parent_phone || 'None linked'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--sb-text-subtle)' }}>Assigned Run:</span>
                      <span style={{ fontWeight: 600, color: 'var(--sb-text-title)' }}>
                        {hasTrip ? `Trip #${s.current_trip_id} (${s.current_bus_number || 'Bus'})` : 'Unassigned'}
                      </span>
                    </div>

                    {(s.pickup_stop_name || s.dropoff_stop_name) && (
                      <div style={{ borderTop: '1px solid var(--sb-border)', paddingTop: 6, marginTop: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                          <span style={{ color: 'var(--sb-success)', fontWeight: 800 }}>●</span>
                          <span>Pickup: <strong>{s.pickup_stop_name}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, marginTop: 2 }}>
                          <span style={{ color: 'var(--sb-danger)', fontWeight: 800 }}>●</span>
                          <span>Dropoff: <strong>{s.dropoff_stop_name}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setTransportTarget(s)}
                      style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
                    >
                      <Bus size={14} style={{ color: 'var(--sb-primary-600)' }} />
                      <span>Assign Transport</span>
                    </button>

                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => setModal({ mode: 'edit', student: s })}
                      style={{ padding: '8px 12px' }}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => setDeleteTarget(s)}
                      style={{ padding: '8px 12px', color: 'var(--sb-danger)' }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 4. Pagination ── */}
          <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12.5, color: 'var(--sb-text-muted)' }}>
              {total === 0 ? 'No results' : `Showing ${firstRow}–${lastRow} of ${total} student${total !== 1 ? 's' : ''}`}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sb-text-title)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {modal?.mode === 'add' && (
        <StudentModal onSave={handleSaved} onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'edit' && (
        <StudentModal initial={modal.student} onSave={handleSaved} onClose={() => setModal(null)} />
      )}
      {transportTarget && (
        <AssignTransportModal
          student={transportTarget}
          onSave={handleSaved}
          onClose={() => setTransportTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete
          student={deleteTarget}
          onConfirm={handleDeleted}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
