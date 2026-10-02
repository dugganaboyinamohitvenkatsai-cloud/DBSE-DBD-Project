import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  GraduationCap,
  Link as LinkIcon,
  Unlink,
  Star,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────── */
const EMPTY_FORM = { name: '', phone: '', email: '', password: '' };

function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* ─── Parent Modal (Add / Edit) ────────────────────────── */
function ParentModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name || '',
          phone: initial.phone || '',
          email: initial.email || '',
          password: '',
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = Boolean(initial?.parent_id);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const path = isEdit
        ? `/admin/parents/${initial.parent_id}`
        : '/admin/parents';
      const method = isEdit ? 'PUT' : 'POST';
      const { parent } = await apiRequest(path, {
        method,
        body: JSON.stringify(form),
      });
      onSave(parent);
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
        aria-labelledby="parent-modal-title"
        style={{ maxWidth: 520, width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>
              {isEdit ? 'Guardian Record Modification' : 'New Family Registration'}
            </span>
            <h2 id="parent-modal-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--sb-primary-950)', marginTop: 4 }}>
              {isEdit ? `Edit Guardian — ${initial.name}` : 'Register New Guardian'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close modal"
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
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="parent-name">
              Full Name *
            </label>
            <input
              id="parent-name"
              className="text-input"
              type="text"
              value={form.name}
              onChange={set('name')}
              required
              autoFocus
              placeholder="e.g. Priya Sharma"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="parent-phone">
              Primary Contact Phone *
            </label>
            <input
              id="parent-phone"
              className="text-input"
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              required
              placeholder="e.g. 9876543210"
            />
            <span style={{ fontSize: 11.5, color: 'var(--sb-text-subtle)', marginTop: 4, display: 'block' }}>
              Used for authentication login, student linking, and safety SMS notifications.
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="field-label" htmlFor="parent-email">
              Email Address (Optional)
            </label>
            <input
              id="parent-email"
              className="text-input"
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="e.g. priya.sharma@example.com"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="field-label" htmlFor="parent-password">
              Portal Password {isEdit ? '(Leave blank to retain current)' : '(Default: Parent@12345)'}
            </label>
            <input
              id="parent-password"
              className="text-input"
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder={isEdit ? 'Leave blank to keep unchanged' : 'e.g. Parent@12345'}
              autoComplete="new-password"
            />
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
                'Register Guardian'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Manage Linked Students Modal ──────────────────────── */
function ManageStudentsModal({ parent, onRefreshParents, onClose }) {
  const [linkedStudents, setLinkedStudents] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [relationshipType, setRelationshipType] = useState('GUARDIAN');
  const [isPrimaryContact, setIsPrimaryContact] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [unlinkConfirm, setUnlinkConfirm] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [parentRes, availRes] = await Promise.all([
        apiRequest(`/admin/parents/${parent.parent_id}`),
        apiRequest('/admin/parents/available-students'),
      ]);
      setLinkedStudents(parentRes.parent?.students || []);
      setAvailableStudents(availRes.students || []);
      setSelectedStudentId('');
      setRelationshipType('GUARDIAN');
      setIsPrimaryContact(true);
    } catch (err) {
      setError(err.message || 'Failed to load student relationship data.');
    } finally {
      setLoading(false);
    }
  }, [parent.parent_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleLink(e) {
    e.preventDefault();
    if (!selectedStudentId) return;
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const res = await apiRequest(`/admin/parents/${parent.parent_id}/students`, {
        method: 'POST',
        body: JSON.stringify({
          student_id: Number(selectedStudentId),
          relationship_type: relationshipType,
          is_primary_contact: isPrimaryContact,
        }),
      });
      setSuccess(res.message || 'Student linked to guardian successfully.');
      await loadData();
      onRefreshParents();
    } catch (err) {
      setError(err.message || 'Failed to link student.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnlink(student) {
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      const res = await apiRequest(
        `/admin/parents/${parent.parent_id}/students/${student.student_id}`,
        {
          method: 'DELETE',
        }
      );
      setSuccess(res.message || 'Student relationship unlinked.');
      setUnlinkConfirm(null);
      await loadData();
      onRefreshParents();
    } catch (err) {
      setError(err.message || 'Failed to unlink student.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-modal-title"
        style={{ maxWidth: 640, width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <span className="eyebrow" style={{ margin: 0 }}>Family Relationship Management</span>
            <h2 id="manage-modal-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--sb-primary-950)', marginTop: 4 }}>
              {parent.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12.5, color: 'var(--sb-text-muted)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Phone size={13} style={{ color: 'var(--sb-primary-600)' }} />
                <strong>{parent.phone}</strong>
              </span>
              {parent.email && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Mail size={13} style={{ color: 'var(--sb-text-subtle)' }} />
                  {parent.email}
                </span>
              )}
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

        {loading ? (
          <div className="page-state" style={{ minHeight: 160 }}>
            <Loader2 size={24} className="sb-spin" style={{ color: 'var(--sb-primary-600)' }} />
            <span>Loading family connections…</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* ── Currently Linked Students ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sb-primary-950)' }}>
                  Authorized Dependents ({linkedStudents.length})
                </h3>
                <span style={{ fontSize: 11.5, color: 'var(--sb-text-subtle)' }}>
                  Receives live transit telemetry
                </span>
              </div>

              {linkedStudents.length === 0 ? (
                <div
                  style={{
                    padding: '20px 16px',
                    textAlign: 'center',
                    backgroundColor: 'var(--sb-surface-muted)',
                    borderRadius: 'var(--sb-radius-sm)',
                    border: '1px dashed var(--sb-border)',
                    color: 'var(--sb-text-muted)',
                    fontSize: 13,
                  }}
                >
                  <GraduationCap size={28} style={{ color: 'var(--sb-text-subtle)', margin: '0 auto 6px' }} />
                  <div>No students currently linked to this guardian record.</div>
                  <div style={{ fontSize: 12, color: 'var(--sb-text-subtle)', marginTop: 2 }}>
                    Link students below to authorize safety notifications and live journey tracking.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {linkedStudents.map((s) => (
                    <div
                      key={s.student_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        backgroundColor: 'var(--sb-surface)',
                        border: '1px solid var(--sb-border)',
                        borderRadius: 'var(--sb-radius-sm)',
                        boxShadow: 'var(--sb-shadow-xs)',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
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
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sb-text-title)' }}>
                            {s.name}
                            <span style={{ fontSize: 12, color: 'var(--sb-text-muted)', fontWeight: 500, marginLeft: 6 }}>
                              (Class: {s.class || '—'})
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: 'var(--sb-radius-sm)',
                                background: 'var(--sb-info-bg)',
                                color: 'var(--sb-info-text)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {s.relationship_type || 'GUARDIAN'}
                            </span>
                            {s.is_primary_contact ? (
                              <span
                                style={{
                                  fontSize: 10.5,
                                  color: 'var(--sb-success)',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                }}
                              >
                                <Star size={11} fill="currentColor" /> Primary Contact
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div>
                        {unlinkConfirm?.student_id === s.student_id ? (
                          <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 11.5, color: 'var(--sb-danger)', fontWeight: 600 }}>
                              Unlink?
                            </span>
                            <button
                              type="button"
                              className="btn-danger"
                              onClick={() => handleUnlink(s)}
                              disabled={actionLoading}
                              style={{ padding: '4px 8px', fontSize: 11.5 }}
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => setUnlinkConfirm(null)}
                              disabled={actionLoading}
                              style={{ padding: '4px 8px', fontSize: 11.5 }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => setUnlinkConfirm(s)}
                            disabled={actionLoading}
                            title={`Unlink ${s.name}`}
                            style={{ color: 'var(--sb-danger)', padding: '5px 8px' }}
                          >
                            <Unlink size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Link a Student (Many-to-Many Association) ── */}
            <div
              style={{
                backgroundColor: 'var(--sb-surface-muted)',
                padding: '16px',
                borderRadius: 'var(--sb-radius-md)',
                border: '1px solid var(--sb-border)',
              }}
            >
              <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--sb-primary-950)', marginBottom: 4 }}>
                + Associate Dependent Student
              </h3>
              <p style={{ color: 'var(--sb-text-muted)', fontSize: 12, margin: '0 0 12px' }}>
                Students support dual-guardian mapping (Father, Mother, Local Guardian) for safety notifications.
              </p>

              {availableStudents.length === 0 ? (
                <div style={{ color: 'var(--sb-text-muted)', fontSize: 12.5 }}>
                  No additional unlinked students found in the roster.
                </div>
              ) : (
                <form onSubmit={handleLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <select
                      className="select-input"
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      disabled={actionLoading}
                      style={{ flex: 2, minWidth: 200, fontSize: 12.5, padding: '8px 10px' }}
                      required
                    >
                      <option value="">-- Select Student to Link --</option>
                      {availableStudents.map((s) => (
                        <option key={s.student_id} value={s.student_id}>
                          {s.name} (#{s.student_id}, Class: {s.class || '—'}){' '}
                          {s.linked_parent_names ? `[Linked: ${s.linked_parent_names}]` : '[Unlinked]'}
                        </option>
                      ))}
                    </select>

                    <select
                      className="select-input"
                      value={relationshipType}
                      onChange={(e) => setRelationshipType(e.target.value)}
                      disabled={actionLoading}
                      style={{ flex: 1, minWidth: 120, fontSize: 12.5, padding: '8px 10px' }}
                    >
                      <option value="FATHER">Father</option>
                      <option value="MOTHER">Mother</option>
                      <option value="GUARDIAN">Guardian</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--sb-text-title)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isPrimaryContact}
                        onChange={(e) => setIsPrimaryContact(e.target.checked)}
                        disabled={actionLoading}
                      />
                      <span>Designate as Primary Emergency Contact</span>
                    </label>

                    <button
                      type="submit"
                      className="primary-button"
                      disabled={!selectedStudentId || actionLoading}
                      style={{ whiteSpace: 'nowrap', padding: '7px 14px', fontSize: 12.5 }}
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 size={13} className="sb-spin" />
                          <span>Linking…</span>
                        </>
                      ) : (
                        <>
                          <LinkIcon size={13} />
                          <span>Link Student</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
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

/* ─── Confirm Delete Dialog with Student Protection ─── */
function ConfirmDelete({ parent, onConfirm, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const isLinked = parent.student_count > 0;

  async function confirm() {
    setDeleting(true);
    setError('');
    try {
      await apiRequest(`/admin/parents/${parent.parent_id}`, { method: 'DELETE' });
      onConfirm(parent.parent_id);
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
          Remove {parent.name}?
        </h2>

        {isLinked ? (
          <div className="alert-box alert-box--warning" style={{ margin: '14px 0' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>
              <strong>Active Student Link Protection</strong>
              <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                This guardian is currently linked to <strong>{parent.student_count} student(s)</strong> ({parent.student_names || 'students'}) via contact phone <code>{parent.phone}</code>.
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--sb-text-muted)' }}>
                Please unlink students before removing the guardian record to protect student safety profiles.
              </p>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--sb-text-muted)', fontSize: 13, marginBottom: 18 }}>
            This action cannot be undone. The guardian record will be permanently deleted from the directory.
          </p>
        )}

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
          <button
            className="btn-danger"
            onClick={confirm}
            disabled={deleting || isLinked}
            title={isLinked ? 'Cannot delete: guardian is linked to students' : 'Delete guardian record'}
          >
            {deleting ? 'Removing…' : 'Delete Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Parents Page ─────────────────────────────────── */
export function ParentsPage() {
  const [parents, setParents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modal, setModal] = useState(null);
  const [manageTarget, setManageTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const debouncedSearch = useDebounce(search);
  const limit = 20;

  const fetchParents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, limit });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const data = await apiRequest(`/admin/parents?${params}`);
      setParents(data.parents);
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
    fetchParents();
  }, [fetchParents]);

  function handleSaved() {
    setModal(null);
    fetchParents();
  }

  function handleDeleted() {
    setDeleteTarget(null);
    fetchParents();
  }

  const firstRow = (page - 1) * limit + 1;
  const lastRow = Math.min(page * limit, total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 1. Page Header (Family Relationship Management) ── */}
      <div className="sb-page-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ margin: 0, wordBreak: 'break-word' }}>
              Family Intelligence & Guardian Directory
            </span>
            <span style={{ color: 'var(--sb-border-strong)' }}>•</span>
            <span style={{ fontSize: 12, color: 'var(--sb-text-muted)' }}>Institutional Safety Directory</span>
          </div>
          <h2 style={{ fontSize: 24, letterSpacing: '-0.025em', color: 'var(--sb-primary-950)', margin: 0, fontWeight: 800 }}>
            Family Guardian Records
          </h2>
          <p style={{ marginTop: 4, fontSize: 13.5, color: 'var(--sb-text-muted)' }}>
            Parent contact authorizations, student relationship links, and automated safety notification channels.
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
            <Users size={15} style={{ color: 'var(--sb-primary-600)' }} />
            <span>{total} Registered Guardian{total === 1 ? '' : 's'}</span>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => setModal({ mode: 'add' })}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            <Plus size={15} />
            <span>Add Guardian</span>
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
            placeholder="Search by parent name, phone, or email…"
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
          <span>Loading family records…</span>
        </div>
      ) : parents.length === 0 ? (
        <div className="empty-state" style={{ padding: 48 }}>
          <Users size={40} style={{ color: 'var(--sb-text-subtle)', marginBottom: 12 }} />
          <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--sb-text-title)' }}>No Family Records Found</h3>
          <p style={{ color: 'var(--sb-text-muted)', fontSize: 13, maxWidth: 400, margin: '6px auto 16px' }}>
            {debouncedSearch
              ? `No parents matched your search for "${debouncedSearch}".`
              : 'No family guardians have been registered in the system yet.'}
          </p>
          {!debouncedSearch && (
            <button
              type="button"
              className="primary-button"
              onClick={() => setModal({ mode: 'add' })}
              style={{ width: 'auto' }}
            >
              <Plus size={15} />
              <span>Add First Guardian</span>
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
                  <th>Guardian & Identity</th>
                  <th>Primary Phone</th>
                  <th>Email Address</th>
                  <th>Authorized Dependents</th>
                  <th style={{ textAlign: 'right', width: 150 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {parents.map((p) => {
                  const studentList = p.student_names ? p.student_names.split(',').map((s) => s.trim()) : [];

                  return (
                    <tr key={p.parent_id}>
                      {/* ID */}
                      <td style={{ fontFamily: 'var(--sb-font-mono)', fontSize: 12, color: 'var(--sb-text-subtle)' }}>
                        #{p.parent_id}
                      </td>

                      {/* Parent Identity */}
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
                            {p.name ? p.name.charAt(0) : 'P'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--sb-text-title)' }}>
                              {p.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--sb-text-muted)' }}>
                              Authorized Guardian
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td>
                        <a
                          href={`tel:${p.phone}`}
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
                          <span>{p.phone}</span>
                        </a>
                      </td>

                      {/* Email */}
                      <td>
                        {p.email ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--sb-text-body)' }}>
                            <Mail size={13} style={{ color: 'var(--sb-text-subtle)' }} />
                            <span>{p.email}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--sb-text-subtle)' }}>—</span>
                        )}
                      </td>

                      {/* Linked Students */}
                      <td>
                        {p.student_count > 0 ? (
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', cursor: 'pointer' }}
                            onClick={() => setManageTarget(p)}
                            title="Click to manage linked students"
                          >
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: 'var(--sb-radius-full)',
                                background: 'var(--sb-primary-50)',
                                color: 'var(--sb-primary-700)',
                                border: '1px solid var(--sb-primary-100)',
                                fontSize: 11.5,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <GraduationCap size={12} />
                              <span>{p.student_count} Student{p.student_count === 1 ? '' : 's'}</span>
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--sb-text-title)', fontWeight: 500 }}>
                              {studentList.join(', ')}
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setManageTarget(p)}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 'var(--sb-radius-sm)',
                              background: 'transparent',
                              border: '1px dashed var(--sb-border-strong)',
                              color: 'var(--sb-text-muted)',
                              fontSize: 11.5,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Plus size={11} /> Link Student
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setManageTarget(p)}
                            title="Manage Linked Students"
                            style={{ padding: '5px 9px', fontSize: 12 }}
                          >
                            <GraduationCap size={13} style={{ color: 'var(--sb-primary-600)' }} />
                            <span>Students</span>
                          </button>

                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => setModal({ mode: 'edit', parent: p })}
                            title="Edit Record"
                            style={{ padding: '5px 8px' }}
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            className="table-action-button"
                            onClick={() => setDeleteTarget(p)}
                            title="Delete Guardian"
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
            {parents.map((p) => {
              const studentList = p.student_names ? p.student_names.split(',').map((s) => s.trim()) : [];

              return (
                <div
                  key={p.parent_id}
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
                  {/* Card Header: Avatar, Name & Phone */}
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
                        {p.name ? p.name.charAt(0) : 'P'}
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
                          {p.name}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--sb-text-muted)' }}>
                          Guardian • #{p.parent_id}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--sb-radius-full)',
                        background: p.student_count > 0 ? 'var(--sb-primary-50)' : 'var(--sb-surface-muted)',
                        color: p.student_count > 0 ? 'var(--sb-primary-700)' : 'var(--sb-text-muted)',
                        border: `1px solid ${p.student_count > 0 ? 'var(--sb-primary-100)' : 'var(--sb-border)'}`,
                        fontSize: 10.5,
                        fontWeight: 700,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.student_count > 0 ? `${p.student_count} Dependent${p.student_count === 1 ? '' : 's'}` : 'Unlinked'}
                    </span>
                  </div>

                  {/* Contact Info & Linked Students */}
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
                      <span style={{ color: 'var(--sb-text-subtle)' }}>Phone:</span>
                      <a
                        href={`tel:${p.phone}`}
                        style={{
                          fontWeight: 700,
                          color: 'var(--sb-text-title)',
                          fontFamily: 'var(--sb-font-mono)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Phone size={12} style={{ color: 'var(--sb-primary-600)' }} />
                        <span>{p.phone}</span>
                      </a>
                    </div>

                    {p.email && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--sb-text-subtle)' }}>Email:</span>
                        <span style={{ color: 'var(--sb-text-title)', fontWeight: 500 }}>{p.email}</span>
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--sb-border)', paddingTop: 6, marginTop: 2 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--sb-text-subtle)' }}>Dependents:</span>
                        <span style={{ fontWeight: 600, color: 'var(--sb-text-title)' }}>
                          {studentList.length > 0 ? studentList.join(', ') : 'None linked'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setManageTarget(p)}
                      style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
                    >
                      <GraduationCap size={14} style={{ color: 'var(--sb-primary-600)' }} />
                      <span>Manage Dependents</span>
                    </button>

                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => setModal({ mode: 'edit', parent: p })}
                      style={{ padding: '8px 12px' }}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      type="button"
                      className="table-action-button"
                      onClick={() => setDeleteTarget(p)}
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
              {total === 0 ? 'No results' : `Showing ${firstRow}–${lastRow} of ${total} guardian${total !== 1 ? 's' : ''}`}
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
        <ParentModal onSave={handleSaved} onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'edit' && (
        <ParentModal initial={modal.parent} onSave={handleSaved} onClose={() => setModal(null)} />
      )}
      {manageTarget && (
        <ManageStudentsModal
          parent={manageTarget}
          onRefreshParents={fetchParents}
          onClose={() => setManageTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDelete
          parent={deleteTarget}
          onConfirm={handleDeleted}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default ParentsPage;
