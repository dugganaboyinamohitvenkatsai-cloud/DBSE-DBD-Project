import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import {
  Bus,
  Search,
  Plus,
  Phone,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Loader2,
  Users,
  UserCheck,
} from 'lucide-react';

/* ─── helpers ──────────────────────────────────────────── */
const EMPTY_FORM = {
  bus_number: '',
  registration_number: '',
  capacity: '',
  assigned_driver_id: '',
  is_active: true,
};

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* ─── Bus Modal (Add / Edit) ────────────────────────── */
function BusModal({ initial, onSave, onClose }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(
    initial
      ? {
          bus_number: initial.bus_number || '',
          registration_number: initial.registration_number || '',
          capacity: initial.capacity ?? '',
          assigned_driver_id: initial.assigned_driver_id ? String(initial.assigned_driver_id) : '',
          is_active: initial.is_active ?? true,
        }
      : EMPTY_FORM
  );

  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchDrivers() {
      setLoadingDrivers(true);
      try {
        const query = isEdit && initial?.id ? `?current_bus_id=${initial.id}` : '';
        const res = await apiRequest(`/admin/buses/available-drivers${query}`);
        if (!cancelled) {
          setAvailableDrivers(res.drivers || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load available drivers:', err);
        }
      } finally {
        if (!cancelled) setLoadingDrivers(false);
      }
    }
    fetchDrivers();
    return () => {
      cancelled = true;
    };
  }, [isEdit, initial?.id]);

  function set(field) {
    return (e) => {
      const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setForm((f) => ({ ...f, [field]: val }));
    };
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const path = isEdit ? `/admin/buses/${initial.id}` : '/admin/buses';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        bus_number: form.bus_number.trim(),
        registration_number: form.registration_number.trim(),
        capacity: Number(form.capacity),
        assigned_driver_id: form.assigned_driver_id ? Number(form.assigned_driver_id) : null,
        is_active: Boolean(form.is_active),
      };

      const res = await apiRequest(path, {
        method,
        body: JSON.stringify(payload),
      });
      onSave(res.bus);
    } catch (err) {
      setError(err.message);
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
        aria-labelledby="bus-modal-title"
        style={{ maxWidth: 540, width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>
              {isEdit ? 'Vehicle Fleet Asset Revision' : 'New Fleet Asset Induction'}
            </span>
            <h2 id="bus-modal-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--sb-primary-950)', marginTop: 4 }}>
              {isEdit ? `Edit Bus — ${initial.bus_number}` : 'Register Fleet Bus'}
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label className="field-label" htmlFor="bus-number">
                Fleet Bus Call-Sign / Number *
              </label>
              <input
                id="bus-number"
                className="text-input"
                type="text"
                required
                autoFocus
                placeholder="e.g. BUS-01"
                value={form.bus_number}
                onChange={set('bus_number')}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="field-label" htmlFor="bus-reg">
                Vehicle Registration Plate *
              </label>
              <input
                id="bus-reg"
                className="text-input"
                type="text"
                required
                placeholder="e.g. AP 09 AB 1234"
                value={form.registration_number}
                onChange={set('registration_number')}
                disabled={saving}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label className="field-label" htmlFor="bus-capacity">
                Passenger Seating Capacity *
              </label>
              <input
                id="bus-capacity"
                className="text-input"
                type="number"
                min="1"
                required
                placeholder="e.g. 40"
                value={form.capacity}
                onChange={set('capacity')}
                disabled={saving}
              />
            </div>

            <div className="form-group">
              <label className="field-label" htmlFor="bus-driver">
                Designated Fleet Operator
              </label>
              <select
                id="bus-driver"
                className="select-input"
                value={form.assigned_driver_id}
                onChange={set('assigned_driver_id')}
                disabled={saving || loadingDrivers}
                style={{ fontSize: 12.5 }}
              >
                <option value="">-- Standby / No Driver Assigned --</option>
                {availableDrivers.map((d) => (
                  <option key={d.id || d.driver_id} value={d.id || d.driver_id}>
                    {d.driver_name || d.full_name} ({d.employee_code})
                    {d.is_currently_assigned ? ' [Currently Assigned]' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isEdit && (
            <div className="form-group" style={{ marginBottom: 20 }}>
              <span className="field-label" style={{ marginBottom: 6 }}>
                Operational Availability
              </span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={set('is_active')}
                  disabled={saving}
                />
                <span>Active Vehicle in Transit Service</span>
              </label>
            </div>
          )}

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={14} className="sb-spin" />
                  <span>Saving…</span>
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Register Bus'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Confirm Delete Dialog ────────────────────────────── */
function ConfirmDelete({ bus, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await apiRequest(`/admin/buses/${bus.id}`, { method: 'DELETE' });
      onConfirm(bus.id);
    } catch (err) {
      setError(err.message);
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
        style={{ maxWidth: 460, width: '100%' }}
      >
        <span className="eyebrow" style={{ color: 'var(--sb-danger)' }}>Removal Authorization</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--sb-primary-950)', marginTop: 4, marginBottom: 8 }}>
          Decommission {bus.bus_number}?
        </h2>
        <p style={{ color: 'var(--sb-text-muted)', fontSize: 13, marginBottom: 16 }}>
          This action permanently removes vehicle <strong>{bus.bus_number}</strong> (Plate: <code>{bus.registration_number}</code>).
          Buses with recorded historical trips cannot be removed. Any assigned driver will be unassigned automatically.
        </p>

        {error && (
          <div className="alert-box alert-box--danger" style={{ marginBottom: 14 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Decommissioning…' : 'Decommission Bus'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Buses Page ─────────────────────────────────── */
export function BusesPage() {
  const [buses, setBuses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const debouncedSearch = useDebounce(search, 350);
  const limit = 20;

  const fetchBuses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit });
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }
      const data = await apiRequest(`/admin/buses?${params}`);
      setBuses(data.buses || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setError(err.message);
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
    fetchBuses();
  }, [fetchBuses]);

  function handleSaved() {
    setModal(null);
    fetchBuses();
  }

  function handleDeleted() {
    setDeleteTarget(null);
    fetchBuses();
  }

  const firstRow = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastRow = Math.min(total, page * limit);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. Page Header (Fleet Inventory) ── */}
      <div className="sb-page-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ margin: 0, wordBreak: 'break-word' }}>
              Fleet Inventory & Asset Management
            </span>
            <span style={{ color: 'var(--sb-border-strong)' }}>•</span>
            <span style={{ fontSize: 12, color: 'var(--sb-text-muted)' }}>Institutional Rolling Stock</span>
          </div>
          <h2 style={{ fontSize: 24, letterSpacing: '-0.025em', color: 'var(--sb-primary-950)', margin: 0, fontWeight: 800 }}>
            Vehicle Fleet Inventory
          </h2>
          <p style={{ marginTop: 4, fontSize: 13.5, color: 'var(--sb-text-muted)' }}>
            Physical bus registry, registration compliance, passenger seating capacities, and dedicated operator assignments.
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
            <Bus size={15} style={{ color: 'var(--sb-primary-600)' }} />
            <span>{total} Fleet Vehicle{total === 1 ? '' : 's'}</span>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => setModal({ mode: 'add' })}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            <Plus size={15} />
            <span>Register Bus</span>
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
            placeholder="Search by bus number, registration plate, or driver…"
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

      {/* ── 3. Directory Presentation ── */}
      {loading ? (
        <div className="page-state" style={{ minHeight: 280 }}>
          <Loader2 size={24} className="sb-spin" style={{ color: 'var(--sb-primary-600)' }} />
          <span>Loading vehicle fleet…</span>
        </div>
      ) : buses.length === 0 ? (
        <div className="empty-state" style={{ padding: 48 }}>
          <Bus size={40} style={{ color: 'var(--sb-text-subtle)', marginBottom: 12 }} />
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--sb-text-title)' }}>No Fleet Vehicles Found</h3>
          <p style={{ color: 'var(--sb-text-muted)', fontSize: 13, maxWidth: 400, margin: '6px auto 16px' }}>
            {debouncedSearch
              ? `No vehicles matched your search for "${debouncedSearch}".`
              : 'No transit buses have been registered in the fleet inventory yet.'}
          </p>
          {!debouncedSearch && (
            <button
              type="button"
              className="primary-button"
              onClick={() => setModal({ mode: 'add' })}
              style={{ width: 'auto' }}
            >
              <Plus size={15} />
              <span>Register First Bus</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View (Hidden on mobile) */}
          <div
            className="hide-mobile"
            style={{
              background: 'var(--sb-surface)',
              border: '1px solid var(--sb-border)',
              borderRadius: 'var(--sb-radius-md)',
              overflow: 'hidden',
              boxShadow: 'var(--sb-shadow-xs)',
            }}
          >
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Vehicle & Call-Sign</th>
                  <th>Registration Plate</th>
                  <th>Passenger Capacity</th>
                  <th>Designated Operator</th>
                  <th>Fleet Readiness</th>
                  <th style={{ textAlign: 'right', width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr key={b.id}>
                    {/* ID */}
                    <td style={{ fontFamily: 'var(--sb-font-mono)', fontSize: 12, color: 'var(--sb-text-subtle)' }}>
                      #{b.id}
                    </td>

                    {/* Vehicle Number */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 'var(--sb-radius-sm)',
                            background: 'var(--sb-primary-50)',
                            color: 'var(--sb-primary-700)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--sb-primary-100)',
                            flexShrink: 0,
                          }}
                        >
                          <Bus size={17} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--sb-text-title)', fontSize: 13.5 }}>
                            {b.bus_number}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--sb-text-muted)' }}>
                            School Transit Unit
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Registration */}
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--sb-font-mono)',
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 'var(--sb-radius-sm)',
                          backgroundColor: 'var(--sb-surface-muted)',
                          border: '1px solid var(--sb-border)',
                          color: 'var(--sb-primary-950)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {b.registration_number}
                      </span>
                    </td>

                    {/* Capacity */}
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--sb-text-title)' }}>
                        <Users size={14} style={{ color: 'var(--sb-text-subtle)' }} />
                        <span style={{ fontWeight: 600 }}>{b.capacity}</span>
                        <span style={{ color: 'var(--sb-text-muted)' }}>Passenger Seats</span>
                      </div>
                    </td>

                    {/* Driver */}
                    <td>
                      {b.driver_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <UserCheck size={14} style={{ color: 'var(--sb-primary-600)', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--sb-text-title)' }}>
                              {b.driver_name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--sb-text-muted)' }}>
                              {b.driver_employee_code} {b.driver_phone ? `• ${b.driver_phone}` : ''}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--sb-text-subtle)', fontStyle: 'italic', fontSize: 12 }}>
                          Standby / Unassigned
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 8px',
                          borderRadius: 'var(--sb-radius-full)',
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: b.is_active ? 'var(--sb-success-bg)' : 'var(--sb-surface-muted)',
                          color: b.is_active ? 'var(--sb-success-text)' : 'var(--sb-text-muted)',
                          border: `1px solid ${b.is_active ? 'var(--sb-success-border)' : 'var(--sb-border)'}`,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: b.is_active ? 'var(--sb-success)' : 'var(--sb-text-subtle)',
                          }}
                        />
                        <span>{b.is_active ? 'Active in Service' : 'Depot Standby'}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => setModal({ mode: 'edit', bus: b })}
                          title="Edit Vehicle Details"
                          style={{ padding: '5px 8px' }}
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => setDeleteTarget(b)}
                          title="Decommission Bus"
                          style={{ padding: '5px 8px', color: 'var(--sb-danger)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Intentional Card Representation (Visible only on <= 768px) */}
          <div className="hide-desktop" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {buses.map((b) => (
              <div
                key={b.id}
                style={{
                  backgroundColor: 'var(--sb-surface)',
                  border: '1px solid var(--sb-border)',
                  borderRadius: 'var(--sb-radius-md)',
                  padding: '14px',
                  boxShadow: 'var(--sb-shadow-xs)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Card Header: Bus Icon, Number & Plate */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--sb-radius-sm)',
                        background: 'var(--sb-primary-50)',
                        color: 'var(--sb-primary-700)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--sb-primary-100)',
                        flexShrink: 0,
                      }}
                    >
                      <Bus size={18} />
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
                        {b.bus_number}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)' }}>
                        Plate: {b.registration_number}
                      </div>
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 'var(--sb-radius-full)',
                      background: b.is_active ? 'var(--sb-success-bg)' : 'var(--sb-surface-muted)',
                      color: b.is_active ? 'var(--sb-success-text)' : 'var(--sb-text-muted)',
                      border: `1px solid ${b.is_active ? 'var(--sb-success-border)' : 'var(--sb-border)'}`,
                      fontSize: 10.5,
                      fontWeight: 700,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {b.is_active ? 'Active' : 'Standby'}
                  </span>
                </div>

                {/* Capacity & Driver Details */}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--sb-text-subtle)' }}>Capacity:</span>
                    <span style={{ fontWeight: 700, color: 'var(--sb-text-title)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} style={{ color: 'var(--sb-text-subtle)' }} />
                      <span>{b.capacity} Passenger Seats</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--sb-text-subtle)' }}>Operator:</span>
                    <span style={{ fontWeight: 600, color: 'var(--sb-text-title)' }}>
                      {b.driver_name ? `${b.driver_name} (${b.driver_employee_code})` : 'Standby / Unassigned'}
                    </span>
                  </div>

                  {b.driver_phone && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--sb-text-subtle)' }}>Driver Phone:</span>
                      <a
                        href={`tel:${b.driver_phone}`}
                        style={{
                          fontWeight: 600,
                          color: 'var(--sb-primary-600)',
                          fontFamily: 'var(--sb-font-mono)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Phone size={12} />
                        <span>{b.driver_phone}</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions Bar */}
                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setModal({ mode: 'edit', bus: b })}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
                  >
                    <Edit2 size={13} style={{ color: 'var(--sb-primary-600)' }} />
                    <span>Edit Vehicle</span>
                  </button>

                  <button
                    type="button"
                    className="table-action-button"
                    onClick={() => setDeleteTarget(b)}
                    style={{ padding: '8px 12px', color: 'var(--sb-danger)' }}
                    title="Decommission"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── 4. Pagination ── */}
          <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 12.5, color: 'var(--sb-text-muted)' }}>
              {total === 0 ? 'No results' : `${firstRow}–${lastRow} of ${total} vehicle${total !== 1 ? 's' : ''}`}
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
        <BusModal onSave={handleSaved} onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'edit' && (
        <BusModal
          initial={modal.bus}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete
          bus={deleteTarget}
          onConfirm={handleDeleted}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default BusesPage;
