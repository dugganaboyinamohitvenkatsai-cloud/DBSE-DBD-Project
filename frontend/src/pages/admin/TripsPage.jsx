import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { RedBusJourneyTracker } from '../../components/RedBusJourneyTracker';
import { SeatAssignmentModal } from '../../components/SeatAssignmentModal';
import {
  Calendar,
  Clock,
  Bus,
  User,
  Route as RouteIcon,
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Radio,
  AlertCircle,
  X,
  Loader2,
  Sun,
  Sunset,
  ShieldCheck,
  Armchair,
} from 'lucide-react';

/* ─── helpers ──────────────────────────────────────────── */
function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const STATUS_CONFIG = {
  SCHEDULED: {
    label: 'Scheduled',
    bg: '#eff6ff',
    color: '#1d4ed8',
    border: '#bfdbfe',
    dot: '#3b82f6',
  },
  STARTED: {
    label: 'Started',
    bg: '#fffbeb',
    color: '#b45309',
    border: '#fde68a',
    dot: '#f59e0b',
  },
  IN_PROGRESS: {
    label: 'In Transit',
    bg: '#eef2ff',
    color: '#4338ca',
    border: '#c7d2fe',
    dot: '#6366f1',
    pulse: true,
  },
  COMPLETED: {
    label: 'Completed',
    bg: '#f0fdf4',
    color: '#15803d',
    border: '#bbf7d0',
    dot: '#22c55e',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: '#fff1f2',
    color: '#be123c',
    border: '#fecdd3',
    dot: '#f43f5e',
  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || {
    label: status,
    bg: '#f8fafc',
    color: '#64748b',
    border: '#e2e8f0',
    dot: '#94a3b8',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 9999,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: '0.02em',
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: cfg.dot,
          boxShadow: cfg.pulse ? `0 0 0 3px ${cfg.bg}` : 'none',
        }}
      />
      {cfg.label}
    </span>
  );
}

function DirectionBadge({ direction }) {
  const isPickup = direction === 'PICKUP';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.02em',
        background: isPickup ? '#fff7ed' : '#f0fdfa',
        color: isPickup ? '#c2410c' : '#0f766e',
        border: `1px solid ${isPickup ? '#fed7aa' : '#99f6e4'}`,
      }}
    >
      {isPickup ? (
        <>
          <Sun size={12} strokeWidth={2.5} />
          <span>Morning Pickup</span>
        </>
      ) : (
        <>
          <Sunset size={12} strokeWidth={2.5} />
          <span>Evening Dropoff</span>
        </>
      )}
    </span>
  );
}

/* ─── trip details modal ──────────────────────────────── */
function TripDetailsModal({ tripId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await apiRequest(`/admin/trips/${tripId}`);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load trip details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="panel"
        style={{
          width: 'min(100%, 680px)',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: 16,
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#2563eb',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
              }}
            >
              Dispatch Telemetry Record
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              Trip #{tripId}
              {data?.trip?.status && <StatusBadge status={data.trip.status} />}
            </h2>
            {data && (
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  marginTop: 8,
                  fontSize: 12.5,
                  color: '#64748b',
                  flexWrap: 'wrap',
                }}
              >
                <DirectionBadge direction={data.trip.direction} />
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: '#475569',
                    fontWeight: 600,
                  }}
                >
                  <Calendar size={13} />
                  {data.trip.trip_date}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#991b1b',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 0',
              color: '#64748b',
              gap: 12,
            }}
          >
            <Loader2 size={28} className="animate-spin" style={{ color: '#2563eb' }} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Retrieving dispatch logs…</span>
          </div>
        ) : !data ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Bus & Driver Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 14,
              }}
            >
              {/* Bus Panel */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#64748b',
                    marginBottom: 8,
                  }}
                >
                  <Bus size={13} style={{ color: '#2563eb' }} />
                  Assigned Fleet Bus
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                  {data.bus.bus_number}
                </div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
                  Reg: <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{data.bus.registration_number}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Passenger Capacity: <strong>{data.bus.capacity} seats</strong>
                </div>
              </div>

              {/* Driver Panel */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#64748b',
                    marginBottom: 8,
                  }}
                >
                  <User size={13} style={{ color: '#16a34a' }} />
                  Designated Operator
                </div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a' }}>
                  {data.driver.full_name}
                </div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
                  Employee Code:{' '}
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      background: '#e2e8f0',
                      padding: '1px 5px',
                      borderRadius: 4,
                    }}
                  >
                    {data.driver.employee_code}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  License: {data.driver.license_number || '—'}{' '}
                  {data.driver.license_expiry ? `(Exp: ${data.driver.license_expiry})` : ''}
                </div>
              </div>
            </div>

            {/* Route corridor */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: '#64748b',
                  }}
                >
                  <RouteIcon size={13} style={{ color: '#7c3aed' }} />
                  Transit Corridor
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Clock size={12} />
                  {data.route.estimated_duration_minutes
                    ? `${data.route.estimated_duration_minutes} Mins Window`
                    : 'Duration not set'}
                </span>
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
                {data.route.name}{' '}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    background: '#e0e7ff',
                    color: '#3730a3',
                    padding: '2px 6px',
                    borderRadius: 4,
                    marginLeft: 6,
                  }}
                >
                  {data.route.route_code}
                </span>
              </div>
              {data.route.description && (
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                  {data.route.description}
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              <div
                style={{
                  padding: '12px 14px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  Scheduled Start
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginTop: 4 }}>
                  {data.trip.scheduled_start_at
                    ? new Date(data.trip.scheduled_start_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </div>
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  Actual Started
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginTop: 4 }}>
                  {data.trip.started_at
                    ? new Date(data.trip.started_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Pending Departure'}
                </div>
              </div>
              <div
                style={{
                  padding: '12px 14px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 10.5,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  Completed At
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginTop: 4 }}>
                  {data.trip.completed_at
                    ? new Date(data.trip.completed_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Incomplete'}
                </div>
              </div>
            </div>

            {/* Ordered Route Stops */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  Sequential Stop Milestones ({data.stops.length})
                </h4>
              </div>
              {data.stops.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    background: '#f8fafc',
                    borderRadius: 10,
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                    fontSize: 13,
                    textAlign: 'center',
                  }}
                >
                  No stops configured for this transit corridor.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxHeight: 220,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {data.stops.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        fontSize: 12.5,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {s.stop_order}
                        </span>
                        <strong style={{ color: '#1e293b' }}>{s.name}</strong>
                      </div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>
                        {s.scheduled_time && (
                          <span style={{ fontWeight: 600, color: '#475569' }}>
                            {s.scheduled_time.slice(0, 5)}
                          </span>
                        )}
                        {s.latitude !== null && s.longitude !== null && (
                          <span style={{ marginLeft: 8, fontFamily: 'monospace', color: '#94a3b8' }}>
                            ({s.latitude.toFixed(4)}, {s.longitude.toFixed(4)})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            {data.trip.notes && (
              <div
                style={{
                  padding: 14,
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: 10,
                  fontSize: 13,
                  color: '#92400e',
                }}
              >
                <strong style={{ fontWeight: 700 }}>Dispatch Notes:</strong> {data.trip.notes}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '8px 18px', fontSize: 13 }}
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── add / edit trip modal ───────────────────────────── */
function TripModal({ initial, onSave, onClose }) {
  const isEdit = Boolean(initial?.id);

  let initialTime = '07:30';
  let initialDate = getTodayString();
  if (initial?.scheduled_start_at) {
    const s = String(initial.scheduled_start_at);
    if (s.includes('T')) {
      const parts = s.split('T');
      initialDate = parts[0];
      initialTime = parts[1].slice(0, 5);
    } else if (s.includes(' ')) {
      const parts = s.split(' ');
      initialDate = parts[0];
      initialTime = parts[1].slice(0, 5);
    }
  } else if (initial?.trip_date) {
    initialDate = initial.trip_date;
  }

  const [form, setForm] = useState({
    bus_id: initial?.bus_id ? String(initial.bus_id) : '',
    driver_id: initial?.driver_id ? String(initial.driver_id) : '',
    route_id: initial?.route_id ? String(initial.route_id) : '',
    trip_date: initialDate,
    direction: initial?.direction || 'PICKUP',
    scheduled_time: initialTime,
    notes: initial?.notes || '',
    status: initial?.status || 'SCHEDULED',
  });

  const [options, setOptions] = useState({ buses: [], drivers: [], routes: [] });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const res = await apiRequest('/admin/trips/options');
        if (!cancelled) setOptions(res);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load dispatch options.');
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    }
    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleBusChange(e) {
    const selectedBusId = e.target.value;
    const selectedBus = options.buses.find((b) => String(b.id) === selectedBusId);

    setForm((prev) => ({
      ...prev,
      bus_id: selectedBusId,
      driver_id: selectedBus?.assigned_driver_id ? String(selectedBus.assigned_driver_id) : '',
    }));
  }

  function set(field) {
    return (e) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  const allowedStatuses = [];
  if (!isEdit) {
    allowedStatuses.push('SCHEDULED');
  } else {
    const cur = initial.status;
    allowedStatuses.push(cur);
    if (cur === 'SCHEDULED') {
      allowedStatuses.push('STARTED', 'CANCELLED');
    } else if (cur === 'STARTED') {
      allowedStatuses.push('IN_PROGRESS', 'COMPLETED', 'CANCELLED');
    } else if (cur === 'IN_PROGRESS') {
      allowedStatuses.push('COMPLETED', 'CANCELLED');
    }
  }

  const selectedBusObj = options.buses.find((b) => String(b.id) === String(form.bus_id));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const scheduled_start_at = `${form.trip_date} ${form.scheduled_time}:00`;

      const payload = {
        bus_id: Number(form.bus_id),
        driver_id: Number(form.driver_id),
        route_id: Number(form.route_id),
        trip_date: form.trip_date,
        direction: form.direction,
        scheduled_start_at,
        notes: form.notes.trim() || null,
      };

      if (isEdit) {
        payload.status = form.status;
      }

      const path = isEdit ? `/admin/trips/${initial.id}` : '/admin/trips';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiRequest(path, {
        method,
        body: JSON.stringify(payload),
      });

      onSave(res.trip);
    } catch (err) {
      setError(err.message || 'Failed to dispatch schedule.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="panel"
        style={{
          width: 'min(100%, 560px)',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: 14,
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#2563eb',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 2,
              }}
            >
              {isEdit ? 'Operational Dispatch Modification' : 'Dispatch Scheduling'}
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {isEdit ? `Edit Schedule #${initial.id} (${initial.route_code || ''})` : 'New Trip Dispatch Schedule'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#991b1b',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Bus Selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: '#334155',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              Assigned Fleet Bus *
            </label>
            <select
              className="select-input"
              value={form.bus_id}
              onChange={handleBusChange}
              required
              disabled={saving || loadingOptions}
              style={{ width: '100%', height: 42, borderRadius: 8, fontSize: 13.5 }}
            >
              <option value="">-- Select Active Vehicle --</option>
              {options.buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bus_number} ({b.registration_number})
                  {b.assigned_driver_name ? ` — Driver: ${b.assigned_driver_name}` : ' [No Driver Assigned]'}
                </option>
              ))}
            </select>
            {selectedBusObj && !selectedBusObj.assigned_driver_id && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: '#b45309',
                  background: '#fef3c7',
                  padding: '6px 10px',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertCircle size={14} />
                Selected bus has no designated driver. Assign driver below.
              </div>
            )}
          </div>

          {/* Driver Selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: '#334155',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              Designated Driver *
            </label>
            <select
              className="select-input"
              value={form.driver_id}
              onChange={set('driver_id')}
              required
              disabled={saving || loadingOptions}
              style={{ width: '100%', height: 42, borderRadius: 8, fontSize: 13.5 }}
            >
              <option value="">-- Select Operator --</option>
              {options.drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name} ({d.employee_code})
                  {selectedBusObj?.assigned_driver_id === d.id ? ' [Assigned to this Bus]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Route Selector */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: '#334155',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              Transit Corridor (Route) *
            </label>
            <select
              className="select-input"
              value={form.route_id}
              onChange={set('route_id')}
              required
              disabled={saving || loadingOptions}
              style={{ width: '100%', height: 42, borderRadius: 8, fontSize: 13.5 }}
            >
              <option value="">-- Select Transit Corridor --</option>
              {options.routes.map((r) => (
                <option key={r.id} value={r.id} disabled={r.stop_count === 0}>
                  {r.name} ({r.route_code}) — {r.stop_count} {r.stop_count === 1 ? 'stop' : 'stops'}
                  {r.stop_count === 0 ? ' [0 stops - Add stops first]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Direction Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                }}
              >
                Service Date *
              </label>
              <input
                type="date"
                required
                value={form.trip_date}
                onChange={set('trip_date')}
                disabled={saving}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 8,
                  padding: '0 12px',
                  border: '1px solid #cbd5e1',
                  fontSize: 13.5,
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                }}
              >
                Service Direction *
              </label>
              <select
                className="select-input"
                value={form.direction}
                onChange={set('direction')}
                required
                disabled={saving}
                style={{ width: '100%', height: 42, borderRadius: 8, fontSize: 13.5 }}
              >
                <option value="PICKUP">🌅 Morning Pickup</option>
                <option value="DROPOFF">🌇 Evening Dropoff</option>
              </select>
            </div>
          </div>

          {/* Time & Status Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#334155',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                }}
              >
                Scheduled Start *
              </label>
              <input
                type="time"
                required
                value={form.scheduled_time}
                onChange={set('scheduled_time')}
                disabled={saving}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 8,
                  padding: '0 12px',
                  border: '1px solid #cbd5e1',
                  fontSize: 13.5,
                }}
              />
            </div>

            {isEdit && (
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#334155',
                    marginBottom: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em',
                  }}
                >
                  Operational Status
                </label>
                <select
                  className="select-input"
                  value={form.status}
                  onChange={set('status')}
                  disabled={saving || allowedStatuses.length <= 1}
                  style={{ width: '100%', height: 42, borderRadius: 8, fontSize: 13.5 }}
                >
                  {allowedStatuses.map((st) => (
                    <option key={st} value={st}>
                      {STATUS_CONFIG[st]?.label || st}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 700,
                color: '#334155',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              Operational Dispatch Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Regular morning run, delayed departure notice, vehicle maintenance remarks..."
              value={form.notes}
              onChange={set('notes')}
              disabled={saving}
              style={{
                width: '100%',
                height: 42,
                borderRadius: 8,
                padding: '0 12px',
                border: '1px solid #cbd5e1',
                fontSize: 13.5,
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 14,
              paddingTop: 16,
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '8px 18px', fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={saving || (selectedBusObj && !selectedBusObj.assigned_driver_id)}
              style={{
                padding: '8px 22px',
                fontSize: 13,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving…
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Schedule Dispatch'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── confirm delete modal ────────────────────────────── */
function ConfirmDeleteTrip({ trip, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const canDelete = trip.status === 'SCHEDULED' || trip.status === 'CANCELLED';

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await apiRequest(`/admin/trips/${trip.id}`, { method: 'DELETE' });
      onConfirm(trip.id);
    } catch (err) {
      setError(err.message || 'Failed to delete trip.');
      setDeleting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="panel"
        style={{
          width: 'min(100%, 460px)',
          backgroundColor: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AlertCircle size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
              Confirm Cancellation
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Delete Trip #{trip.id}?
            </h3>
          </div>
        </div>

        {!canDelete ? (
          <div
            style={{
              padding: 12,
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: 8,
              fontSize: 13,
              color: '#92400e',
              marginBottom: 16,
            }}
          >
            ⚠️ Trips with status <strong>{trip.status}</strong> cannot be deleted. Only{' '}
            <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>SCHEDULED</code> or{' '}
            <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>CANCELLED</code> runs may be removed.
          </div>
        ) : (
          <p style={{ color: '#64748b', fontSize: 13.5, lineHeight: 1.5, marginBottom: 18 }}>
            Are you sure you want to permanently remove Trip <strong>#{trip.id}</strong> (
            {trip.route_name || trip.route_code}) scheduled for{' '}
            <strong style={{ color: '#0f172a' }}>{trip.trip_date}</strong>?
          </p>
        )}

        {error && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#991b1b',
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={deleting}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            Cancel
          </button>
          {canDelete && (
            <button
              type="button"
              className="btn-danger"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {deleting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete Schedule'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── live journey modal (RedBus) ─────────────────────── */
function LiveJourneyModal({ tripId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchJourney = useCallback(async () => {
    try {
      const res = await apiRequest(`/trips/${tripId}/journey`);
      setData(res);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch live journey.');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchJourney();
    const interval = setInterval(fetchJourney, 6000);
    return () => clearInterval(interval);
  }, [fetchJourney]);

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="panel"
        style={{
          width: 'min(100%, 780px)',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: 14,
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                color: '#2563eb',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 2,
              }}
            >
              <Radio size={12} className="animate-pulse" style={{ color: '#ef4444' }} />
              Live Radar Telemetry
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Trip #{tripId} Live Journey
            </h2>
            {data && (
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                Bus: <strong style={{ color: '#0f172a' }}>{data.trip.bus_number}</strong> • Route:{' '}
                <strong style={{ color: '#0f172a' }}>{data.trip.route_name}</strong> • Operator:{' '}
                <strong style={{ color: '#0f172a' }}>{data.trip.driver_name}</strong>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#991b1b',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 0',
              color: '#64748b',
              gap: 12,
            }}
          >
            <Loader2 size={32} className="animate-spin" style={{ color: '#2563eb' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Connecting to telemetry feed…</span>
          </div>
        ) : !data ? null : (
          <RedBusJourneyTracker
            journey={data.journey}
            location={data.location}
            trip={data.trip}
          />
        )}
      </div>
    </div>
  );
}

/* ─── main page component ─────────────────────────────── */
export function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [tripModal, setTripModal] = useState(null);
  const [detailsTripId, setDetailsTripId] = useState(null);
  const [liveJourneyTripId, setLiveJourneyTripId] = useState(null);
  const [seatModalTripId, setSeatModalTripId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const debouncedSearch = useDebounce(search, 350);
  const limit = 20;

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (statusFilter.trim()) params.set('status', statusFilter.trim());
      if (dateFilter.trim()) params.set('date', dateFilter.trim());

      const data = await apiRequest(`/admin/trips?${params}`);
      setTrips(data.items || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setError(err.message || 'Failed to load trips.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, dateFilter]);

  const prevFilters = useRef({ search: debouncedSearch, status: statusFilter, date: dateFilter });
  useEffect(() => {
    const prev = prevFilters.current;
    if (prev.search !== debouncedSearch || prev.status !== statusFilter || prev.date !== dateFilter) {
      prevFilters.current = { search: debouncedSearch, status: statusFilter, date: dateFilter };
      setPage(1);
    }
  }, [debouncedSearch, statusFilter, dateFilter]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  function handleSaved() {
    setTripModal(null);
    fetchTrips();
  }

  function handleDeleted() {
    setDeleteTarget(null);
    fetchTrips();
  }

  const firstRow = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastRow = Math.min(total, page * limit);

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
            <span>DISPATCH & FLEET OPERATIONS</span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ color: '#64748b' }}>Active Schedules & Runs</span>
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
            Trip Operations & Dispatch
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 640 }}>
            Real-time dispatch schedules, live route tracking, driver assignments, and trip execution monitoring.
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
            <span>{total} Dispatched Runs</span>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => setTripModal({ mode: 'add' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              fontSize: 13.5,
              fontWeight: 700,
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Schedule Trip</span>
          </button>
        </div>
      </div>

      {/* ── Toolbar & Filters ── */}
      <div className="sb-toolbar-panel">
        <div className="sb-toolbar-search-wrap">
          <Search size={16} className="sb-toolbar-search-icon" />
          <input
            className="search-input"
            type="search"
            placeholder="Search route, bus, driver, or code…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Status Filter */}
          <select
            className="select-input"
            style={{ width: 'auto', minWidth: 140, height: 38, fontSize: 13 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="STARTED">Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              className="select-input"
              style={{ width: 'auto', height: 38, fontSize: 13, padding: '0 10px' }}
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filter by trip date"
            />
            {dateFilter && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDateFilter('')}
                style={{ height: 38, padding: '0 10px', fontSize: 12 }}
                title="Clear date filter"
              >
                Clear Date
              </button>
            )}
          </div>
        </div>

        <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500, marginLeft: 'auto' }}>
          Showing {firstRow}–{lastRow} of {total} records
        </span>
      </div>

      {/* ── Content & Error ── */}
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
          <span style={{ fontSize: 14, fontWeight: 500 }}>Synchronizing dispatch schedule…</span>
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
            <Calendar size={26} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
            No Trips Found
          </h3>
          <p style={{ fontSize: 13.5, color: '#64748b', margin: '0 0 16px 0' }}>
            {debouncedSearch || statusFilter || dateFilter
              ? 'No trips match the selected search and filter criteria.'
              : 'No transportation trips scheduled yet.'}
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => setTripModal({ mode: 'add' })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <Plus size={15} />
            <span>Schedule First Trip</span>
          </button>
        </div>
      ) : (
        <>
          {/* ── Desktop Data Table ── */}
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
                    ID & Direction
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Transit Corridor
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Fleet Vehicle
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Assigned Driver
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Schedule & Date
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Execution Status
                  </th>
                  <th style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    {/* ID & Direction */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: '#64748b' }}>
                          #{t.id}
                        </span>
                        <DirectionBadge direction={t.direction} />
                      </div>
                    </td>

                    {/* Transit Corridor */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                        {t.route_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: 11,
                            fontWeight: 700,
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '1px 6px',
                            borderRadius: 4,
                            border: '1px solid #dbeafe',
                          }}
                        >
                          {t.route_code}
                        </span>
                        {t.estimated_duration_minutes && (
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            • {t.estimated_duration_minutes} Mins
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Fleet Vehicle */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Bus size={14} style={{ color: '#2563eb' }} />
                        <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                          {t.bus_number}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>
                        {t.registration_number}
                      </div>
                    </td>

                    {/* Assigned Driver */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a' }}>
                        {t.driver_name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: 'monospace',
                            color: '#475569',
                            background: '#f1f5f9',
                            padding: '1px 5px',
                            borderRadius: 4,
                          }}
                        >
                          {t.driver_employee_code}
                        </span>
                        {t.driver_phone && (
                          <span style={{ fontSize: 11.5, color: '#64748b' }}>
                            {t.driver_phone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Schedule & Date */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        <Calendar size={13} style={{ color: '#64748b' }} />
                        {t.trip_date}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        <Clock size={12} />
                        {t.scheduled_start_at
                          ? new Date(t.scheduled_start_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={t.status} />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setLiveJourneyTripId(t.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: '1px solid #bfdbfe',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title="Live Radar Tracking"
                        >
                          <Radio size={13} style={{ color: '#2563eb' }} />
                          <span>Track</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSeatModalTripId(t.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 9px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            color: '#1e293b',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          title="Manage Bus Seat Allocations"
                        >
                          <Armchair size={13} style={{ color: '#2563eb' }} />
                          <span>Seats</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDetailsTripId(t.id)}
                          style={{
                            padding: '6px 8px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            color: '#475569',
                            cursor: 'pointer',
                          }}
                          title="View Dispatch Record"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setTripModal({ mode: 'edit', trip: t })}
                          style={{
                            padding: '6px 8px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 6,
                            color: '#475569',
                            cursor: 'pointer',
                          }}
                          title="Edit Schedule"
                        >
                          <Edit2 size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(t)}
                          style={{
                            padding: '6px 8px',
                            background: '#fff1f2',
                            border: '1px solid #fecdd3',
                            borderRadius: 6,
                            color: '#e11d48',
                            cursor: 'pointer',
                          }}
                          title="Delete Schedule"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Mobile Card Deck ── */}
          <div className="hide-desktop" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {trips.map((t) => (
              <div
                key={t.id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 14,
                  border: '1px solid #e2e8f0',
                  padding: 16,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#64748b' }}>
                        #{t.id}
                      </span>
                      <DirectionBadge direction={t.direction} />
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginTop: 2 }}>
                      {t.route_name}
                    </div>
                  </div>
                  <StatusBadge status={t.status} />
                </div>

                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 12.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Bus & Plate:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      {t.bus_number} ({t.registration_number})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Driver:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      {t.driver_name} ({t.driver_employee_code})
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Schedule:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      {t.trip_date} at{' '}
                      {t.scheduled_start_at
                        ? new Date(t.scheduled_start_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setLiveJourneyTripId(t.id)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Radio size={14} style={{ color: '#2563eb' }} />
                    <span>Track Live</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSeatModalTripId(t.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#1e293b',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Armchair size={15} style={{ color: '#2563eb' }} />
                    <span>Seats</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailsTripId(t.id)}
                    style={{
                      padding: '8px 12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    <Eye size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setTripModal({ mode: 'edit', trip: t })}
                    style={{
                      padding: '8px 12px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    <Edit2 size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(t)}
                    style={{
                      padding: '8px 12px',
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: 8,
                      color: '#e11d48',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Pagination ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#ffffff',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              marginTop: 10,
            }}
          >
            <span style={{ fontSize: 13, color: '#64748b' }}>
              {total === 0 ? 'No results' : `${firstRow}–${lastRow} of ${total} trips`}
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: '6px 14px', fontSize: 12.5 }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: '6px 14px', fontSize: 12.5 }}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {tripModal?.mode === 'add' && (
        <TripModal onSave={handleSaved} onClose={() => setTripModal(null)} />
      )}
      {tripModal?.mode === 'edit' && (
        <TripModal
          initial={tripModal.trip}
          onSave={handleSaved}
          onClose={() => setTripModal(null)}
        />
      )}
      {detailsTripId && (
        <TripDetailsModal
          tripId={detailsTripId}
          onClose={() => setDetailsTripId(null)}
        />
      )}
      {liveJourneyTripId && (
        <LiveJourneyModal
          tripId={liveJourneyTripId}
          onClose={() => setLiveJourneyTripId(null)}
        />
      )}
      {seatModalTripId && (
        <SeatAssignmentModal
          tripId={seatModalTripId}
          onClose={() => setSeatModalTripId(null)}
          onUpdated={fetchTrips}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteTrip
          trip={deleteTarget}
          onConfirm={handleDeleted}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
