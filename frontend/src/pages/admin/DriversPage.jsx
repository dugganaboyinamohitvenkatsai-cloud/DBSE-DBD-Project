import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import {
  UserCheck,
  Search,
  Plus,
  Phone,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Loader2,
  Clock,
} from 'lucide-react';

/* ─── helpers ──────────────────────────────────────────── */
const EMPTY_FORM = {
  full_name: '',
  email: '',
  password: '',
  phone: '',
  employee_code: '',
  license_number: '',
  license_expiry: '',
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

function getExpiryStatus(expiryStr) {
  if (!expiryStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryStr);
  expiry.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return {
      status: 'expired',
      label: `Expired (${expiryStr})`,
      bg: 'var(--sb-danger-bg)',
      color: 'var(--sb-danger-text)',
      border: 'var(--sb-danger-border)',
    };
  }
  if (diffDays <= 30) {
    return {
      status: 'warning',
      label: `Expiring in ${diffDays}d`,
      bg: 'var(--sb-warning-bg)',
      color: 'var(--sb-warning-text)',
      border: 'var(--sb-warning-border)',
    };
  }
  return {
    status: 'ok',
    label: `Valid (${expiryStr})`,
    bg: 'var(--sb-success-bg)',
    color: 'var(--sb-success-text)',
    border: 'var(--sb-success-border)',
  };
}

/* ─── Driver Modal (Add / Edit) ────────────────────────── */
function DriverModal({ initial, onSave, onClose }) {
  const isEdit = Boolean(initial?.driver_id);
  const [form, setForm] = useState(
    initial
      ? {
          full_name: initial.full_name || '',
          email: initial.email || '',
          password: '',
          phone: initial.phone || '',
          employee_code: initial.employee_code || '',
          license_number: initial.license_number || '',
          license_expiry: initial.license_expiry ? initial.license_expiry.split('T')[0] : '',
          is_active: initial.is_active ?? true,
        }
      : EMPTY_FORM
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      const path = isEdit
        ? `/admin/drivers/${initial.driver_id}`
        : '/admin/drivers';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = { ...form };
      if (isEdit && !payload.password) {
        delete payload.password;
      }

      const res = await apiRequest(path, {
        method,
        body: JSON.stringify(payload),
      });
      onSave(res.driver);
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
        aria-labelledby="driver-modal-title"
        style={{ maxWidth: 560, width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>
              {isEdit ? 'Driver Profile Modification' : 'New Fleet Operator Registration'}
            </span>
            <h2 id="driver-modal-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--sb-primary-950)', marginTop: 4 }}>
              {isEdit ? `Edit Driver — ${initial.full_name}` : 'Register Fleet Driver'}
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
              <label className="field-label" htmlFor="driver-fullname">
                Full Name *
              </label>
              <input
                id="driver-fullname"
                className="text-input"
                type="text"
                value={form.full_name}
                onChange={set('full_name')}
                required
                autoFocus
                placeholder="e.g. Rajesh Kumar"
              />
            </div>

            <div className="form-group">
              <label className="field-label" htmlFor="driver-email">
                Operator Email Address *
              </label>
              <input
                id="driver-email"
                className="text-input"
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                placeholder="e.g. rajesh.driver@schoolbus.local"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label className="field-label" htmlFor="driver-code">
                Employee Code *
              </label>
              <input
                id="driver-code"
                className="text-input"
                type="text"
                value={form.employee_code}
                onChange={set('employee_code')}
                required
                placeholder="e.g. DRV-101"
              />
            </div>

            <div className="form-group">
              <label className="field-label" htmlFor="driver-phone">
                Contact Phone Number
              </label>
              <input
                id="driver-phone"
                className="text-input"
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                placeholder="e.g. 9876543210"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div className="form-group">
              <label className="field-label" htmlFor="driver-license">
                Driving License Number *
              </label>
              <input
                id="driver-license"
                className="text-input"
                type="text"
                value={form.license_number}
                onChange={set('license_number')}
                required
                placeholder="e.g. DL-0420110012345"
              />
            </div>

            <div className="form-group">
              <label className="field-label" htmlFor="driver-expiry">
                License Expiry Date *
              </label>
              <input
                id="driver-expiry"
                className="text-input"
                type="date"
                value={form.license_expiry}
                onChange={set('license_expiry')}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
            <div className="form-group">
              <label className="field-label" htmlFor="driver-password">
                {isEdit ? 'New Password (Optional)' : 'Password *'}
              </label>
              <input
                id="driver-password"
                className="text-input"
                type="password"
                value={form.password}
                onChange={set('password')}
                required={!isEdit}
                placeholder={isEdit ? 'Leave blank to keep existing' : 'Minimum 6 characters'}
                autoComplete="new-password"
              />
            </div>

            {isEdit && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span className="field-label" style={{ marginBottom: 6 }}>
                  Operational Status
                </span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={set('is_active')}
                  />
                  <span>Active Driver Account</span>
                </label>
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
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
                'Register Driver'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Confirm Delete Dialog ────────────────────────────── */
function ConfirmDelete({ driver, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setDeleting(true);
    setError('');
    try {
      await apiRequest(`/admin/drivers/${driver.driver_id}`, { method: 'DELETE' });
      onConfirm(driver.driver_id);
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
          Remove {driver.full_name}?
        </h2>
        <p style={{ color: 'var(--sb-text-muted)', fontSize: 13, marginBottom: 16 }}>
          This action permanently removes the driver profile and authentication credentials.
          Drivers with assigned buses or active trip records cannot be removed.
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
          <button className="btn-danger" onClick={confirm} disabled={deleting}>
            {deleting ? 'Removing…' : 'Delete Driver'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Drivers Page ─────────────────────────────────── */
export function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const debouncedSearch = useDebounce(search);
  const limit = 20;

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const data = await apiRequest(`/admin/drivers?${params}`);
      setDrivers(data.drivers);
      setTotal(data.total);
      setTotalPages(data.totalPages);
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
    fetchDrivers();
  }, [fetchDrivers]);

  function handleSaved() {
    setModal(null);
    fetchDrivers();
  }

  function handleDeleted() {
    setDeleteTarget(null);
    fetchDrivers();
  }

  const firstRow = (page - 1) * limit + 1;
  const lastRow = Math.min(page * limit, total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. Page Header (Driver Operations Directory) ── */}
      <div className="sb-page-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ margin: 0, wordBreak: 'break-word' }}>
              Fleet Operations & Driver Directory
            </span>
            <span style={{ color: 'var(--sb-border-strong)' }}>•</span>
            <span style={{ fontSize: 12, color: 'var(--sb-text-muted)' }}>Licensed Transit Operators</span>
          </div>
          <h2 style={{ fontSize: 24, letterSpacing: '-0.025em', color: 'var(--sb-primary-950)', margin: 0, fontWeight: 800 }}>
            Driver Operations Directory
          </h2>
          <p style={{ marginTop: 4, fontSize: 13.5, color: 'var(--sb-text-muted)' }}>
            Licensed vehicle operators, commercial driving credentials, compliance records, and active fleet assignments.
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
            <UserCheck size={15} style={{ color: 'var(--sb-primary-600)' }} />
            <span>{total} Licensed Driver{total === 1 ? '' : 's'}</span>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => setModal({ mode: 'add' })}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            <Plus size={15} />
            <span>Register Driver</span>
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
            placeholder="Search by name, employee code, license, email, or phone…"
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
          <span>Loading driver directory…</span>
        </div>
      ) : drivers.length === 0 ? (
        <div className="empty-state" style={{ padding: 48 }}>
          <UserCheck size={40} style={{ color: 'var(--sb-text-subtle)', marginBottom: 12 }} />
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--sb-text-title)' }}>No Drivers Found</h3>
          <p style={{ color: 'var(--sb-text-muted)', fontSize: 13, maxWidth: 400, margin: '6px auto 16px' }}>
            {debouncedSearch
              ? `No drivers matched your search for "${debouncedSearch}".`
              : 'No commercial drivers have been registered in the system yet.'}
          </p>
          {!debouncedSearch && (
            <button
              type="button"
              className="primary-button"
              onClick={() => setModal({ mode: 'add' })}
              style={{ width: 'auto' }}
            >
              <Plus size={15} />
              <span>Register First Driver</span>
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
                  <th>Driver & Operator</th>
                  <th>Employee Code</th>
                  <th>License & Expiry</th>
                  <th>Contact Phone</th>
                  <th>Compliance Status</th>
                  <th style={{ textAlign: 'right', width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => {
                  const expiryInfo = getExpiryStatus(d.license_expiry);

                  return (
                    <tr key={d.driver_id}>
                      {/* ID */}
                      <td style={{ fontFamily: 'var(--sb-font-mono)', fontSize: 12, color: 'var(--sb-text-subtle)' }}>
                        #{d.driver_id}
                      </td>

                      {/* Driver & Identity */}
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
                            {d.full_name ? d.full_name.charAt(0) : 'D'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--sb-text-title)' }}>
                              {d.full_name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--sb-text-muted)' }}>
                              {d.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Employee Code */}
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--sb-font-mono)',
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 'var(--sb-radius-sm)',
                            backgroundColor: 'var(--sb-surface-muted)',
                            border: '1px solid var(--sb-border)',
                            color: 'var(--sb-primary-950)',
                          }}
                        >
                          {d.employee_code}
                        </span>
                      </td>

                      {/* License & Expiry */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontFamily: 'var(--sb-font-mono)', fontSize: 12, color: 'var(--sb-text-title)', fontWeight: 600 }}>
                            {d.license_number}
                          </span>
                          {expiryInfo && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 'var(--sb-radius-sm)',
                                backgroundColor: expiryInfo.bg,
                                color: expiryInfo.color,
                                border: `1px solid ${expiryInfo.border}`,
                                width: 'fit-content',
                              }}
                            >
                              <Clock size={11} />
                              <span>{expiryInfo.label}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Contact Phone */}
                      <td>
                        {d.phone ? (
                          <a
                            href={`tel:${d.phone}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontFamily: 'var(--sb-font-mono)',
                              fontSize: 12.5,
                              color: 'var(--sb-text-title)',
                              textDecoration: 'none',
                            }}
                          >
                            <Phone size={13} style={{ color: 'var(--sb-primary-600)' }} />
                            <span>{d.phone}</span>
                          </a>
                        ) : (
                          <span style={{ color: 'var(--sb-text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* Compliance / Active Status */}
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
                            backgroundColor: d.is_active ? 'var(--sb-success-bg)' : 'var(--sb-surface-muted)',
                            color: d.is_active ? 'var(--sb-success-text)' : 'var(--sb-text-muted)',
                            border: `1px solid ${d.is_active ? 'var(--sb-success-border)' : 'var(--sb-border)'}`,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: d.is_active ? 'var(--sb-success)' : 'var(--sb-text-subtle)',
                            }}
                          />
                          <span>{d.is_active ? 'Active Operator' : 'Suspended / Inactive'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => setModal({ mode: 'edit', driver: d })}
                            title="Edit Driver Details"
                            style={{ padding: '5px 8px' }}
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => setDeleteTarget(d)}
                            title="Delete Driver Record"
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
            {drivers.map((d) => {
              const expiryInfo = getExpiryStatus(d.license_expiry);

              return (
                <div
                  key={d.driver_id}
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
                  {/* Card Header: Avatar, Name & Code */}
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
                        {d.full_name ? d.full_name.charAt(0) : 'D'}
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
                          {d.full_name}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)' }}>
                          {d.employee_code} • #{d.driver_id}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--sb-radius-full)',
                        background: d.is_active ? 'var(--sb-success-bg)' : 'var(--sb-surface-muted)',
                        color: d.is_active ? 'var(--sb-success-text)' : 'var(--sb-text-muted)',
                        border: `1px solid ${d.is_active ? 'var(--sb-success-border)' : 'var(--sb-border)'}`,
                        fontSize: 10.5,
                        fontWeight: 700,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Credentials & Details */}
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
                      <span style={{ color: 'var(--sb-text-subtle)' }}>License:</span>
                      <span style={{ fontWeight: 700, fontFamily: 'var(--sb-font-mono)', color: 'var(--sb-text-title)' }}>
                        {d.license_number}
                      </span>
                    </div>

                    {expiryInfo && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--sb-text-subtle)' }}>Validity:</span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 'var(--sb-radius-sm)',
                            backgroundColor: expiryInfo.bg,
                            color: expiryInfo.color,
                            border: `1px solid ${expiryInfo.border}`,
                          }}
                        >
                          {expiryInfo.label}
                        </span>
                      </div>
                    )}

                    {d.phone && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--sb-text-subtle)' }}>Contact:</span>
                        <a
                          href={`tel:${d.phone}`}
                          style={{
                            fontWeight: 600,
                            color: 'var(--sb-text-title)',
                            fontFamily: 'var(--sb-font-mono)',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Phone size={12} style={{ color: 'var(--sb-primary-600)' }} />
                          <span>{d.phone}</span>
                        </a>
                      </div>
                    )}

                    {d.email && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--sb-text-subtle)' }}>Email:</span>
                        <span style={{ color: 'var(--sb-text-title)', fontWeight: 500 }}>{d.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setModal({ mode: 'edit', driver: d })}
                      style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
                    >
                      <Edit2 size={13} style={{ color: 'var(--sb-primary-600)' }} />
                      <span>Edit Credentials</span>
                    </button>

                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => setDeleteTarget(d)}
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
              {total === 0 ? 'No results' : `Showing ${firstRow}–${lastRow} of ${total} driver${total !== 1 ? 's' : ''}`}
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
        <DriverModal onSave={handleSaved} onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'edit' && (
        <DriverModal
          initial={modal.driver}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete
          driver={deleteTarget}
          onConfirm={handleDeleted}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default DriversPage;
