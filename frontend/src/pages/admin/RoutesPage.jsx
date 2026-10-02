import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import {
  Route as RouteIcon,
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  MapPin,
  Clock,
  ArrowUp,
  ArrowDown,
  ExternalLink,
} from 'lucide-react';

/* ─── helpers ──────────────────────────────────────────── */
const EMPTY_ROUTE_FORM = {
  route_code: '',
  name: '',
  estimated_duration_minutes: '',
  description: '',
  is_active: true,
};

const EMPTY_STOP_FORM = {
  name: '',
  stop_order: '',
  latitude: '',
  longitude: '',
  scheduled_time: '',
  google_maps_url: '',
};

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* ─── Route Modal (Add / Edit) ────────────────────────── */
function RouteModal({ initial, onSave, onClose }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(
    initial
      ? {
          route_code: initial.route_code || '',
          name: initial.name || '',
          estimated_duration_minutes: initial.estimated_duration_minutes ?? '',
          description: initial.description || '',
          is_active: initial.is_active ?? true,
        }
      : EMPTY_ROUTE_FORM
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
      const path = isEdit ? `/admin/routes/${initial.id}` : '/admin/routes';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        route_code: form.route_code.trim(),
        name: form.name.trim(),
        description: form.description ? form.description.trim() : null,
        estimated_duration_minutes: form.estimated_duration_minutes
          ? Number(form.estimated_duration_minutes)
          : null,
        is_active: Boolean(form.is_active),
      };

      const res = await apiRequest(path, {
        method,
        body: JSON.stringify(payload),
      });
      onSave(res.route);
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
        aria-labelledby="route-modal-title"
        style={{ maxWidth: 540, width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>
              {isEdit ? 'Corridor Network Revision' : 'New Corridor Planning'}
            </span>
            <h2 id="route-modal-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--sb-primary-950)', marginTop: 4 }}>
              {isEdit ? `Edit Route — ${initial.route_code}` : 'Define Route Corridor'}
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
              <label className="field-label" htmlFor="route-code">
                Corridor Identifier / Code *
              </label>
              <input
                id="route-code"
                className="text-input"
                type="text"
                required
                autoFocus
                placeholder="e.g. RT-HYD-01"
                value={form.route_code}
                onChange={set('route_code')}
                disabled={saving}
                maxLength={40}
              />
            </div>

            <div className="form-group">
              <label className="field-label" htmlFor="route-duration">
                Planned Duration (Minutes)
              </label>
              <input
                id="route-duration"
                className="text-input"
                type="number"
                min="1"
                max="65535"
                placeholder="e.g. 45"
                value={form.estimated_duration_minutes}
                onChange={set('estimated_duration_minutes')}
                disabled={saving}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="route-name">
              Corridor Name (Origin → Destination) *
            </label>
            <input
              id="route-name"
              className="text-input"
              type="text"
              required
              placeholder="e.g. MotiNagar – KLH BHP Campus"
              value={form.name}
              onChange={set('name')}
              disabled={saving}
              maxLength={120}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="route-desc">
              Operational Scope & Description
            </label>
            <input
              id="route-desc"
              className="text-input"
              type="text"
              placeholder="e.g. Covers Moti Nagar, Mee Seva, and BHP campus waypoints"
              value={form.description}
              onChange={set('description')}
              disabled={saving}
            />
          </div>

          {isEdit && (
            <div className="form-group" style={{ marginBottom: 20 }}>
              <span className="field-label" style={{ marginBottom: 6 }}>
                Operational State
              </span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={set('is_active')}
                  disabled={saving}
                />
                <span>Active Transit Corridor</span>
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
                'Create Corridor'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Confirm Delete Route Dialog ──────────────────────── */
function ConfirmDeleteRoute({ route, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await apiRequest(`/admin/routes/${route.id}`, { method: 'DELETE' });
      onConfirm(route.id);
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
        style={{ maxWidth: 480, width: '100%' }}
      >
        <span className="eyebrow" style={{ color: 'var(--sb-danger)' }}>Removal Authorization</span>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--sb-primary-950)', marginTop: 4, marginBottom: 8 }}>
          Decommission {route.route_code}?
        </h2>
        <div className="alert-box alert-box--warning" style={{ marginBottom: 14 }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Cascading Stop Deletion Warning</strong>
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>
              Deleting this corridor will permanently delete all associated waypoint stops.
              Corridors with historical trip records cannot be removed.
            </p>
          </div>
        </div>
        <p style={{ color: 'var(--sb-text-muted)', fontSize: 13, marginBottom: 16 }}>
          Are you sure you want to permanently delete corridor <strong>{route.name}</strong> (<code>{route.route_code}</code>)?
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
            {deleting ? 'Deleting…' : 'Delete Corridor'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Manage Stops Modal (Sequential Corridor Waypoints) ── */
function ManageStopsModal({ route, onClose, onRouteUpdated }) {
  const [stops, setStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStop, setEditingStop] = useState(null);
  const [deleteConfirmStop, setDeleteConfirmStop] = useState(null);

  const [stopForm, setStopForm] = useState(EMPTY_STOP_FORM);
  const [actionLoading, setActionLoading] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);

  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [resolvedData, setResolvedData] = useState(null);

  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationSearchDebounceRef = useRef(null);

  const fetchStops = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/admin/routes/${route.id}`);
      setStops(res.stops || []);
      setOrderDirty(false);
    } catch (err) {
      setError(err.message || 'Failed to load waypoint stops.');
    } finally {
      setLoading(false);
    }
  }, [route.id]);

  useEffect(() => {
    fetchStops();
  }, [fetchStops]);

  function handleSetForm(field) {
    return (e) => {
      setStopForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  function handleLocationSearchInput(val) {
    setLocationQuery(val);
    if (!val || val.trim().length < 2) {
      setLocationSuggestions([]);
      setShowLocationDropdown(false);
      return;
    }
    if (locationSearchDebounceRef.current) {
      clearTimeout(locationSearchDebounceRef.current);
    }
    locationSearchDebounceRef.current = setTimeout(async () => {
      setSearchingLocation(true);
      try {
        const res = await apiRequest(`/admin/routes/search-location?query=${encodeURIComponent(val.trim())}`);
        if (res && res.success && Array.isArray(res.results)) {
          setLocationSuggestions(res.results);
          setShowLocationDropdown(res.results.length > 0);
        }
      } catch (err) {
        console.warn('Location search error:', err);
      } finally {
        setSearchingLocation(false);
      }
    }, 350);
  }

  function handleSelectLocationSuggestion(item) {
    setStopForm((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : (item.name || item.display_name.split(',')[0]).trim(),
      latitude: String(item.latitude),
      longitude: String(item.longitude),
    }));
    setResolvedData({
      latitude: item.latitude,
      longitude: item.longitude,
      address: item.display_name,
    });
    setLocationQuery(item.display_name);
    setShowLocationDropdown(false);
  }

  function handleOpenAdd() {
    setStopForm({ ...EMPTY_STOP_FORM, stop_order: '' });
    setEditingStop(null);
    setShowAddForm(true);
    setResolvedData(null);
    setResolveError('');
    setLocationQuery('');
    setLocationSuggestions([]);
    setShowLocationDropdown(false);
    setError('');
    setSuccess('');
  }

  function handleOpenEdit(stop) {
    setStopForm({
      name: stop.name || '',
      stop_order: stop.stop_order !== null ? String(stop.stop_order) : '',
      latitude: stop.latitude !== null ? String(stop.latitude) : '',
      longitude: stop.longitude !== null ? String(stop.longitude) : '',
      scheduled_time: stop.scheduled_time ? String(stop.scheduled_time).slice(0, 5) : '',
      google_maps_url: stop.google_maps_url || '',
    });
    setEditingStop(stop);
    setShowAddForm(false);
    setResolvedData(null);
    setResolveError('');
    setLocationQuery('');
    setLocationSuggestions([]);
    setShowLocationDropdown(false);
    setError('');
    setSuccess('');
  }

  function handleCancelForm() {
    setShowAddForm(false);
    setEditingStop(null);
    setResolvedData(null);
    setResolveError('');
    setLocationQuery('');
    setLocationSuggestions([]);
    setShowLocationDropdown(false);
    setError('');
  }

  async function handleResolveLocation() {
    const rawUrl = stopForm.google_maps_url?.trim();
    if (!rawUrl) return;

    setResolvingLocation(true);
    setResolveError('');
    setResolvedData(null);

    try {
      const res = await apiRequest('/admin/routes/resolve-location', {
        method: 'POST',
        body: JSON.stringify({ url: rawUrl }),
      });

      if (res.latitude !== undefined && res.longitude !== undefined) {
        setStopForm((prev) => ({
          ...prev,
          latitude: String(res.latitude),
          longitude: String(res.longitude),
        }));
        setResolvedData({
          latitude: res.latitude,
          longitude: res.longitude,
          address: res.formatted_address || null,
        });
      } else {
        throw new Error('Unable to extract coordinates from this Google Maps link. Please verify link or enter manually.');
      }
    } catch (err) {
      setResolveError(
        err.message || 'Unable to resolve coordinates. Please verify link or enter manually.'
      );
    } finally {
      setResolvingLocation(false);
    }
  }

  async function handleCreateStop(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setActionLoading(true);

    try {
      const payload = {
        name: stopForm.name.trim(),
        stop_order: stopForm.stop_order.trim() ? Number(stopForm.stop_order) : null,
        latitude: stopForm.latitude.trim() ? Number(stopForm.latitude) : null,
        longitude: stopForm.longitude.trim() ? Number(stopForm.longitude) : null,
        scheduled_time: stopForm.scheduled_time.trim() || null,
        google_maps_url: stopForm.google_maps_url?.trim() || null,
      };

      await apiRequest(`/admin/routes/${route.id}/stops`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccess('Waypoint stop added to corridor.');
      setShowAddForm(false);
      setStopForm(EMPTY_STOP_FORM);
      await fetchStops();
      if (onRouteUpdated) onRouteUpdated();
    } catch (err) {
      setError(err.message || 'Failed to add stop.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateStop(e) {
    e.preventDefault();
    if (!editingStop) return;
    setError('');
    setSuccess('');
    setActionLoading(true);

    try {
      const payload = {
        name: stopForm.name.trim(),
        stop_order: stopForm.stop_order.trim() ? Number(stopForm.stop_order) : null,
        latitude: stopForm.latitude.trim() ? Number(stopForm.latitude) : null,
        longitude: stopForm.longitude.trim() ? Number(stopForm.longitude) : null,
        scheduled_time: stopForm.scheduled_time.trim() || null,
        google_maps_url: stopForm.google_maps_url?.trim() || null,
      };

      await apiRequest(`/admin/routes/${route.id}/stops/${editingStop.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setSuccess('Waypoint stop updated successfully.');
      setEditingStop(null);
      setStopForm(EMPTY_STOP_FORM);
      await fetchStops();
      if (onRouteUpdated) onRouteUpdated();
    } catch (err) {
      setError(err.message || 'Failed to update stop.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteStop(stopId) {
    setError('');
    setSuccess('');
    setActionLoading(true);

    try {
      await apiRequest(`/admin/routes/${route.id}/stops/${stopId}`, {
        method: 'DELETE',
      });
      setSuccess('Stop removed from corridor and remaining sequence updated.');
      setDeleteConfirmStop(null);
      await fetchStops();
      if (onRouteUpdated) onRouteUpdated();
    } catch (err) {
      setError(err.message || 'Failed to delete stop.');
    } finally {
      setActionLoading(false);
    }
  }

  function handleMove(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= stops.length) return;

    const updated = [...stops];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setStops(updated);
    setOrderDirty(true);
    setError('');
    setSuccess('');
  }

  async function handleSaveOrder() {
    setError('');
    setSuccess('');
    setActionLoading(true);

    try {
      const stop_ids = stops.map((s) => s.id);
      await apiRequest(`/admin/routes/${route.id}/stops/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ stop_ids }),
      });

      setSuccess('Waypoint sequence updated.');
      setOrderDirty(false);
      await fetchStops();
      if (onRouteUpdated) onRouteUpdated();
    } catch (err) {
      setError(err.message || 'Failed to save waypoint sequence.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card panel"
        style={{ width: 'min(100%, 720px)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-stops-title"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>Corridor Waypoint Sequencing</span>
            <h2 id="manage-stops-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--sb-primary-950)', marginTop: 4 }}>
              {route.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: 12.5, color: 'var(--sb-text-muted)' }}>
              <span>Code: <code>{route.route_code}</code></span>
              <span>•</span>
              <span>Total Waypoints: <strong>{stops.length}</strong></span>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {success && (
          <div className="alert-box alert-box--success" style={{ marginBottom: 14 }}>
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="alert-box alert-box--danger" style={{ marginBottom: 14 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {orderDirty && (
          <div className="alert-box alert-box--warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span>Unsaved waypoint order changes.</span>
            <button
              type="button"
              className="primary-button"
              style={{ width: 'auto', padding: '5px 12px', fontSize: 12 }}
              onClick={handleSaveOrder}
              disabled={actionLoading}
            >
              {actionLoading ? 'Saving…' : 'Save Sequence'}
            </button>
          </div>
        )}

        {/* ── Add / Edit Stop Sub-Panel ── */}
        {(showAddForm || editingStop) && (
          <div
            style={{
              backgroundColor: 'var(--sb-surface-muted)',
              border: '1px solid var(--sb-border)',
              borderRadius: 'var(--sb-radius-md)',
              padding: '16px',
              marginBottom: 18,
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--sb-primary-950)', marginBottom: 12 }}>
              {editingStop ? `Edit Stop #${editingStop.stop_order}` : 'Define New Waypoint Stop'}
            </h3>
            <form onSubmit={editingStop ? handleUpdateStop : handleCreateStop}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label className="field-label" htmlFor="stop-name">
                    Stop Name *
                  </label>
                  <input
                    id="stop-name"
                    className="text-input"
                    type="text"
                    required
                    placeholder="e.g. Moti Nagar Cross Road"
                    value={stopForm.name}
                    onChange={handleSetForm('name')}
                    disabled={actionLoading}
                    maxLength={120}
                  />
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="stop-order">
                    Sequence Order Number
                  </label>
                  <input
                    id="stop-order"
                    className="text-input"
                    type="number"
                    min="1"
                    placeholder={showAddForm ? 'Leave blank to append at end' : 'Sequence #'}
                    value={stopForm.stop_order}
                    onChange={handleSetForm('stop_order')}
                    disabled={actionLoading}
                  />
                </div>
              </div>

              {/* Location Search / Autocomplete Box */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--sb-surface)',
                  borderRadius: 'var(--sb-radius-sm)',
                  border: '1px solid var(--sb-border)',
                  marginBottom: 12,
                  position: 'relative',
                }}
              >
                <label className="field-label" style={{ marginBottom: 6 }}>
                  Search Place / Landmark / Address
                  <span style={{ fontWeight: 400, color: 'var(--sb-text-muted)', marginLeft: 6, fontSize: 11.5 }}>
                    (Type to search places and auto-fill coordinates)
                  </span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="text-input"
                    type="text"
                    placeholder="e.g. Secunderabad Station, Jubilee Hills, Banjara Hills..."
                    value={locationQuery}
                    onChange={(e) => handleLocationSearchInput(e.target.value)}
                    disabled={actionLoading}
                    style={{ width: '100%', paddingLeft: 34, paddingRight: 34 }}
                  />
                  <Search
                    size={15}
                    style={{
                      position: 'absolute',
                      left: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--sb-text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                  {searchingLocation && (
                    <Loader2
                      size={15}
                      className="sb-spin"
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--sb-primary-600)',
                      }}
                    />
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {showLocationDropdown && locationSuggestions.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      backgroundColor: 'var(--sb-surface)',
                      border: '1px solid var(--sb-border)',
                      borderRadius: 'var(--sb-radius-sm)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      marginTop: 4,
                      maxHeight: 220,
                      overflowY: 'auto',
                    }}
                  >
                    {locationSuggestions.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectLocationSuggestion(item)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: idx < locationSuggestions.length - 1 ? '1px solid var(--sb-border)' : 'none',
                          fontSize: 12,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sb-surface-muted)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--sb-primary-950)' }}>
                          {item.name || (item.display_name && item.display_name.split(',')[0])}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--sb-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.display_name}
                        </div>
                        <div style={{ fontSize: 10.5, fontFamily: 'var(--sb-font-mono)', color: 'var(--sb-primary-600)', marginTop: 2 }}>
                          Lat: {item.latitude}, Lng: {item.longitude}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Google Maps Resolver Box */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'var(--sb-surface)',
                  borderRadius: 'var(--sb-radius-sm)',
                  border: '1px solid var(--sb-border)',
                  marginBottom: 12,
                }}
              >
                <label className="field-label" style={{ marginBottom: 6 }}>
                  Google Maps Place / Coordinate Link
                  <span style={{ fontWeight: 400, color: 'var(--sb-text-muted)', marginLeft: 6, fontSize: 11.5 }}>
                    (Paste link to automatically resolve latitude and longitude)
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    className="text-input"
                    type="url"
                    placeholder="https://maps.google.com/?q=... or https://maps.app.goo.gl/..."
                    value={stopForm.google_maps_url}
                    onChange={handleSetForm('google_maps_url')}
                    disabled={actionLoading || resolvingLocation}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleResolveLocation}
                    disabled={actionLoading || resolvingLocation || !stopForm.google_maps_url.trim()}
                    style={{
                      whiteSpace: 'nowrap',
                      padding: '7px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {resolvingLocation ? (
                      <>
                        <Loader2 size={12} className="sb-spin" />
                        <span>Resolving…</span>
                      </>
                    ) : (
                      <>
                        <MapPin size={12} style={{ color: 'var(--sb-primary-600)' }} />
                        <span>Resolve GPS</span>
                      </>
                    )}
                  </button>
                </div>

                {resolveError && (
                  <div className="alert-box alert-box--danger" style={{ marginTop: 8, fontSize: 12, padding: '6px 10px' }}>
                    <AlertCircle size={14} />
                    <span>{resolveError}</span>
                  </div>
                )}

                {resolvedData && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '8px 12px',
                      backgroundColor: 'var(--sb-success-bg)',
                      border: '1px solid var(--sb-success-border)',
                      borderRadius: 'var(--sb-radius-sm)',
                      color: 'var(--sb-success-text)',
                      fontSize: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong>GPS Coordinates Extracted</strong>
                      <div style={{ fontFamily: 'var(--sb-font-mono)', fontSize: 11.5 }}>
                        Lat: {resolvedData.latitude}, Lng: {resolvedData.longitude}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>✓ Resolved</span>
                  </div>
                )}
              </div>

              {/* Coordinates & Schedule Time */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="field-label" htmlFor="stop-lat">
                    Latitude
                  </label>
                  <input
                    id="stop-lat"
                    className="text-input"
                    type="number"
                    step="any"
                    placeholder="e.g. 17.4699"
                    value={stopForm.latitude}
                    onChange={handleSetForm('latitude')}
                    disabled={actionLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="stop-lng">
                    Longitude
                  </label>
                  <input
                    id="stop-lng"
                    className="text-input"
                    type="number"
                    step="any"
                    placeholder="e.g. 78.3578"
                    value={stopForm.longitude}
                    onChange={handleSetForm('longitude')}
                    disabled={actionLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="stop-time">
                    Scheduled Time
                  </label>
                  <input
                    id="stop-time"
                    className="text-input"
                    type="time"
                    value={stopForm.scheduled_time}
                    onChange={handleSetForm('scheduled_time')}
                    disabled={actionLoading}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={handleCancelForm} disabled={actionLoading}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={actionLoading}>
                  {actionLoading ? 'Saving…' : editingStop ? 'Update Stop' : 'Add Stop'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Toolbar for Stops ── */}
        {!showAddForm && !editingStop && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sb-primary-950)' }}>
              Ordered Corridor Stops ({stops.length})
            </span>
            <button
              type="button"
              className="primary-button"
              style={{ padding: '6px 12px', fontSize: 12.5 }}
              onClick={handleOpenAdd}
              disabled={actionLoading}
            >
              <Plus size={13} />
              <span>Add Waypoint Stop</span>
            </button>
          </div>
        )}

        {/* ── Stop List ── */}
        {loading ? (
          <div className="page-state" style={{ minHeight: 140 }}>
            <Loader2 size={24} className="sb-spin" style={{ color: 'var(--sb-primary-600)' }} />
            <span>Loading corridor stops…</span>
          </div>
        ) : stops.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              backgroundColor: 'var(--sb-surface-muted)',
              borderRadius: 'var(--sb-radius-sm)',
              border: '1px dashed var(--sb-border)',
              color: 'var(--sb-text-muted)',
              fontSize: 13,
            }}
          >
            <MapPin size={28} style={{ color: 'var(--sb-text-subtle)', margin: '0 auto 6px' }} />
            <div>No waypoint stops currently defined for this corridor.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stops.map((s, idx) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: 'var(--sb-surface)',
                  border: '1px solid var(--sb-border)',
                  borderRadius: 'var(--sb-radius-sm)',
                  boxShadow: 'var(--sb-shadow-xs)',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 'var(--sb-radius-full)',
                      backgroundColor: 'var(--sb-primary-50)',
                      color: 'var(--sb-primary-700)',
                      fontWeight: 800,
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--sb-primary-100)',
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--sb-text-title)' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      {s.scheduled_time && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={11} style={{ color: 'var(--sb-text-subtle)' }} />
                          {s.scheduled_time.slice(0, 5)}
                        </span>
                      )}
                      {s.latitude !== null && s.longitude !== null ? (
                        <span style={{ fontFamily: 'var(--sb-font-mono)', fontSize: 11, color: 'var(--sb-text-subtle)' }}>
                          📍 ({Number(s.latitude).toFixed(4)}, {Number(s.longitude).toFixed(4)})
                        </span>
                      ) : (
                        <span style={{ color: 'var(--sb-text-subtle)', fontStyle: 'italic' }}>GPS unassigned</span>
                      )}
                      {s.google_maps_url && (
                        <a
                          href={s.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--sb-primary-600)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            textDecoration: 'none',
                            fontWeight: 600,
                          }}
                        >
                          <ExternalLink size={11} /> Map
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions & Ordering */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className="table-action-button"
                    title="Move Stop Up"
                    disabled={idx === 0 || actionLoading}
                    onClick={() => handleMove(idx, -1)}
                    style={{ opacity: idx === 0 ? 0.3 : 1, padding: '4px 6px' }}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="table-action-button"
                    title="Move Stop Down"
                    disabled={idx === stops.length - 1 || actionLoading}
                    onClick={() => handleMove(idx, 1)}
                    style={{ opacity: idx === stops.length - 1 ? 0.3 : 1, padding: '4px 6px' }}
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    className="table-action-button"
                    title="Edit Stop"
                    disabled={actionLoading}
                    onClick={() => handleOpenEdit(s)}
                    style={{ padding: '4px 6px' }}
                  >
                    <Edit2 size={13} />
                  </button>
                  {deleteConfirmStop?.id === s.id ? (
                    <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={actionLoading}
                        onClick={() => handleDeleteStop(s.id)}
                        style={{ padding: '3px 6px', fontSize: 11 }}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '3px 6px', fontSize: 11 }}
                        disabled={actionLoading}
                        onClick={() => setDeleteConfirmStop(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="table-action-button"
                      title="Delete Stop"
                      disabled={actionLoading}
                      onClick={() => setDeleteConfirmStop(s)}
                      style={{ padding: '4px 6px', color: 'var(--sb-danger)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Routes Page ─────────────────────────────────── */
export function RoutesPage() {
  const [routes, setRoutes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [routeModal, setRouteModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [manageStopsRoute, setManageStopsRoute] = useState(null);

  const debouncedSearch = useDebounce(search, 350);
  const limit = 20;

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit });
      if (debouncedSearch.trim()) {
        params.set('search', debouncedSearch.trim());
      }
      const data = await apiRequest(`/admin/routes?${params}`);
      setRoutes(data.routes || []);
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
    fetchRoutes();
  }, [fetchRoutes]);

  function handleRouteSaved() {
    setRouteModal(null);
    fetchRoutes();
  }

  function handleRouteDeleted() {
    setDeleteTarget(null);
    fetchRoutes();
  }

  const firstRow = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastRow = Math.min(total, page * limit);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. Page Header (Corridor Network Planning) ── */}
      <div className="sb-page-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ margin: 0, wordBreak: 'break-word' }}>
              Transportation Network Planning
            </span>
            <span style={{ color: 'var(--sb-border-strong)' }}>•</span>
            <span style={{ fontSize: 12, color: 'var(--sb-text-muted)' }}>Operational Transit Corridors</span>
          </div>
          <h2 style={{ fontSize: 24, letterSpacing: '-0.025em', color: 'var(--sb-primary-950)', margin: 0, fontWeight: 800 }}>
            Transit Corridor Network
          </h2>
          <p style={{ marginTop: 4, fontSize: 13.5, color: 'var(--sb-text-muted)' }}>
            Geographic route planning, sequential stop corridor sequences, and geofence waypoint coordinates.
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
            <RouteIcon size={15} style={{ color: 'var(--sb-primary-600)' }} />
            <span>{total} Transit Corridor{total === 1 ? '' : 's'}</span>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => setRouteModal({ mode: 'add' })}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            <Plus size={15} />
            <span>Create Route Corridor</span>
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
            placeholder="Search by route code, corridor name, or description…"
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
          <span>Loading transit network…</span>
        </div>
      ) : routes.length === 0 ? (
        <div className="empty-state" style={{ padding: 48 }}>
          <RouteIcon size={40} style={{ color: 'var(--sb-text-subtle)', marginBottom: 12 }} />
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--sb-text-title)' }}>No Corridors Found</h3>
          <p style={{ color: 'var(--sb-text-muted)', fontSize: 13, maxWidth: 400, margin: '6px auto 16px' }}>
            {debouncedSearch
              ? `No corridors matched your search for "${debouncedSearch}".`
              : 'No transit corridors have been configured in the system yet.'}
          </p>
          {!debouncedSearch && (
            <button
              type="button"
              className="primary-button"
              onClick={() => setRouteModal({ mode: 'add' })}
              style={{ width: 'auto' }}
            >
              <Plus size={15} />
              <span>Create First Corridor</span>
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
                  <th>Corridor & Code</th>
                  <th>Corridor Waypoint Sequence</th>
                  <th>Transit Window</th>
                  <th>Corridor Readiness</th>
                  <th style={{ textAlign: 'right', width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r.id}>
                    {/* ID */}
                    <td style={{ fontFamily: 'var(--sb-font-mono)', fontSize: 12, color: 'var(--sb-text-subtle)' }}>
                      #{r.id}
                    </td>

                    {/* Route Code & Name */}
                    <td>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontFamily: 'var(--sb-font-mono)',
                              fontSize: 11.5,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 'var(--sb-radius-sm)',
                              backgroundColor: 'var(--sb-primary-50)',
                              color: 'var(--sb-primary-700)',
                              border: '1px solid var(--sb-primary-100)',
                            }}
                          >
                            {r.route_code}
                          </span>
                          <span style={{ fontWeight: 800, color: 'var(--sb-text-title)' }}>
                            {r.name}
                          </span>
                        </div>
                        {r.description && (
                          <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)', marginTop: 3 }}>
                            {r.description}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Stop Sequence & Waypoints */}
                    <td>
                      <div
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                        onClick={() => setManageStopsRoute(r)}
                        title="Click to view and edit waypoint sequence"
                      >
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 'var(--sb-radius-full)',
                            background: r.stop_count > 0 ? 'var(--sb-primary-50)' : 'var(--sb-surface-muted)',
                            color: r.stop_count > 0 ? 'var(--sb-primary-700)' : 'var(--sb-text-muted)',
                            border: `1px solid ${r.stop_count > 0 ? 'var(--sb-primary-100)' : 'var(--sb-border)'}`,
                            fontSize: 11.5,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <MapPin size={12} />
                          <span>{r.stop_count} Waypoint Stop{r.stop_count === 1 ? '' : 's'}</span>
                        </span>
                      </div>
                    </td>

                    {/* Duration */}
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--sb-text-title)' }}>
                        <Clock size={13} style={{ color: 'var(--sb-text-subtle)' }} />
                        <span style={{ fontWeight: 600 }}>
                          {r.estimated_duration_minutes !== null ? `${r.estimated_duration_minutes} Mins` : '—'}
                        </span>
                      </div>
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
                          backgroundColor: r.is_active ? 'var(--sb-success-bg)' : 'var(--sb-surface-muted)',
                          color: r.is_active ? 'var(--sb-success-text)' : 'var(--sb-text-muted)',
                          border: `1px solid ${r.is_active ? 'var(--sb-success-border)' : 'var(--sb-border)'}`,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: r.is_active ? 'var(--sb-success)' : 'var(--sb-text-subtle)',
                          }}
                        />
                        <span>{r.is_active ? 'Active Corridor' : 'Suspended'}</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setManageStopsRoute(r)}
                          title="Manage Waypoints"
                          style={{ padding: '5px 9px', fontSize: 12 }}
                        >
                          <MapPin size={13} style={{ color: 'var(--sb-primary-600)' }} />
                          <span>Stops</span>
                        </button>

                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => setRouteModal({ mode: 'edit', route: r })}
                          title="Edit Corridor"
                          style={{ padding: '5px 8px' }}
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          type="button"
                          className="table-action-button"
                          onClick={() => setDeleteTarget(r)}
                          title="Delete Corridor"
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
            {routes.map((r) => (
              <div
                key={r.id}
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
                {/* Card Header: Code, Name & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span
                        style={{
                          fontFamily: 'var(--sb-font-mono)',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 'var(--sb-radius-sm)',
                          backgroundColor: 'var(--sb-primary-50)',
                          color: 'var(--sb-primary-700)',
                          border: '1px solid var(--sb-primary-100)',
                        }}
                      >
                        {r.route_code}
                      </span>
                    </div>
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
                      {r.name}
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 'var(--sb-radius-full)',
                      background: r.is_active ? 'var(--sb-success-bg)' : 'var(--sb-surface-muted)',
                      color: r.is_active ? 'var(--sb-success-text)' : 'var(--sb-text-muted)',
                      border: `1px solid ${r.is_active ? 'var(--sb-success-border)' : 'var(--sb-border)'}`,
                      fontSize: 10.5,
                      fontWeight: 700,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Corridor Details */}
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
                    <span style={{ color: 'var(--sb-text-subtle)' }}>Waypoints:</span>
                    <span style={{ fontWeight: 700, color: 'var(--sb-text-title)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} style={{ color: 'var(--sb-primary-600)' }} />
                      <span>{r.stop_count} Stops Defined</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--sb-text-subtle)' }}>Transit Window:</span>
                    <span style={{ fontWeight: 600, color: 'var(--sb-text-title)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} style={{ color: 'var(--sb-text-subtle)' }} />
                      <span>{r.estimated_duration_minutes ? `${r.estimated_duration_minutes} Mins` : 'Unassigned'}</span>
                    </span>
                  </div>

                  {r.description && (
                    <div style={{ borderTop: '1px solid var(--sb-border)', paddingTop: 6, marginTop: 2, fontSize: 11.5, color: 'var(--sb-text-muted)' }}>
                      {r.description}
                    </div>
                  )}
                </div>

                {/* Actions Bar */}
                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setManageStopsRoute(r)}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
                  >
                    <MapPin size={13} style={{ color: 'var(--sb-primary-600)' }} />
                    <span>Manage Stops</span>
                  </button>

                  <button
                    type="button"
                    className="table-action-button"
                    onClick={() => setRouteModal({ mode: 'edit', route: r })}
                    style={{ padding: '8px 12px' }}
                    title="Edit"
                  >
                    <Edit2 size={13} />
                  </button>

                  <button
                    type="button"
                    className="table-action-button"
                    onClick={() => setDeleteTarget(r)}
                    style={{ padding: '8px 12px', color: 'var(--sb-danger)' }}
                    title="Delete"
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
              {total === 0 ? 'No results' : `${firstRow}–${lastRow} of ${total} corridor${total !== 1 ? 's' : ''}`}
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
      {routeModal?.mode === 'add' && (
        <RouteModal onSave={handleRouteSaved} onClose={() => setRouteModal(null)} />
      )}
      {routeModal?.mode === 'edit' && (
        <RouteModal
          initial={routeModal.route}
          onSave={handleRouteSaved}
          onClose={() => setRouteModal(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteRoute
          route={deleteTarget}
          onConfirm={handleRouteDeleted}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {manageStopsRoute && (
        <ManageStopsModal
          route={manageStopsRoute}
          onClose={() => setManageStopsRoute(null)}
          onRouteUpdated={fetchRoutes}
        />
      )}
    </div>
  );
}

export default RoutesPage;
