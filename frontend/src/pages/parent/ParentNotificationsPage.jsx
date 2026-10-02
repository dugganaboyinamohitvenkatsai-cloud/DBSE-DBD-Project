import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import {
  Bell,
  BellOff,
  CheckCheck,
  MapPin,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bus,
  Route as RouteIcon,
  Clock,
  Check,
  Shield,
  Loader2,
  AlertCircle,
} from 'lucide-react';

const TYPE_CONFIG = {
  STOP_REACHED: {
    icon: MapPin,
    label: 'Geofence Stop Reached',
    color: '#15803d',
    bg: '#f0fdf4',
    border: '#bbf7d0',
  },
  TRIP_STARTED: {
    icon: Play,
    label: 'Transit Commenced',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  TRIP_COMPLETED: {
    icon: CheckCircle2,
    label: 'Transit Concluded',
    color: '#0f766e',
    bg: '#f0fdfa',
    border: '#99f6e4',
  },
  TRIP_CANCELLED: {
    icon: XCircle,
    label: 'Schedule Cancelled',
    color: '#be123c',
    bg: '#fff1f2',
    border: '#fecdd3',
  },
  ALERT: {
    icon: AlertTriangle,
    label: 'Operational Alert',
    color: '#b45309',
    bg: '#fffbeb',
    border: '#fde68a',
  },
};

function getTypeConfig(type) {
  return (
    TYPE_CONFIG[type] || {
      icon: Bell,
      label: type || 'Transit Notice',
      color: '#475569',
      bg: '#f8fafc',
      border: '#e2e8f0',
    }
  );
}

function NotificationCard({ notif, onMarkRead }) {
  const cfg = getTypeConfig(notif.type);
  const IconComponent = cfg.icon;
  const sentAt = notif.sent_at ? new Date(notif.sent_at) : new Date(notif.created_at);
  const [marking, setMarking] = useState(false);

  async function handleRead() {
    setMarking(true);
    await onMarkRead(notif.id);
    setMarking(false);
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '16px 20px',
        backgroundColor: notif.is_read ? '#ffffff' : '#f8faff',
        border: `1px solid ${notif.is_read ? '#e2e8f0' : '#bfdbfe'}`,
        borderRadius: 12,
        position: 'relative',
        boxShadow: notif.is_read ? '0 1px 2px rgba(0, 0, 0, 0.04)' : '0 2px 6px rgba(37, 99, 235, 0.08)',
        transition: 'all 0.15s ease',
      }}
    >
      {/* Unread beacon */}
      {!notif.is_read && (
        <div
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#2563eb',
              boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.2)',
            }}
          />
        </div>
      )}

      {/* Leading Icon Badge */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: cfg.bg,
          border: `1px solid ${cfg.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: cfg.color,
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        <IconComponent size={20} strokeWidth={2.2} />
      </div>

      {/* Main Body */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: notif.is_read ? 0 : 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: cfg.color,
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            {cfg.label}
          </span>
        </div>

        <h3
          style={{
            fontSize: 15,
            fontWeight: notif.is_read ? 700 : 800,
            color: '#0f172a',
            margin: '0 0 6px 0',
            letterSpacing: '-0.01em',
          }}
        >
          {notif.title}
        </h3>

        <p
          style={{
            fontSize: 13.5,
            color: '#475569',
            lineHeight: 1.5,
            margin: '0 0 10px 0',
          }}
        >
          {notif.body}
        </p>

        {/* Metadata Ribbon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 12,
            color: '#64748b',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Clock size={13} />
            {sentAt.toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>

          {notif.bus_number && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#f1f5f9',
                padding: '2px 8px',
                borderRadius: 4,
                color: '#334155',
                fontWeight: 600,
              }}
            >
              <Bus size={12} style={{ color: '#2563eb' }} />
              {notif.bus_number}
            </span>
          )}

          {notif.route_name && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#f1f5f9',
                padding: '2px 8px',
                borderRadius: 4,
                color: '#334155',
                fontWeight: 600,
              }}
            >
              <RouteIcon size={12} style={{ color: '#7c3aed' }} />
              {notif.route_name}
            </span>
          )}

          {!notif.is_read && (
            <button
              type="button"
              onClick={handleRead}
              disabled={marking}
              style={{
                marginLeft: 'auto',
                background: '#ffffff',
                border: '1px solid #bfdbfe',
                color: '#2563eb',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {marking ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Check size={12} strokeWidth={2.5} />
              )}
              <span>Mark Read</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ParentNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, unread: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'STOPS' | 'TRANSIT'

  const fetchNotifications = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const data = await apiRequest(`/parent/notifications?page=${page}&limit=20`);
      setNotifications(data.notifications || []);
      setPagination(data.pagination || { total: 0, unread: 0, page: 1, limit: 20 });
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch safety alerts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  async function handleMarkRead(id) {
    try {
      await apiRequest(`/parent/notifications/${id}/read`, { method: 'PUT' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setPagination((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } catch {
      // silently retain UI state
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await apiRequest('/parent/notifications/read-all', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setPagination((prev) => ({ ...prev, unread: 0 }));
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  }

  // Filter items in view
  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'UNREAD') return !n.is_read;
    if (activeFilter === 'STOPS') return n.type === 'STOP_REACHED';
    if (activeFilter === 'TRANSIT') return n.type === 'TRIP_STARTED' || n.type === 'TRIP_COMPLETED' || n.type === 'TRIP_CANCELLED';
    return true;
  });

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
            <span>STUDENT SAFETY & TRANSIT DISPATCH</span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span style={{ color: '#64748b' }}>Real-Time Broadcasts</span>
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
            Safety & Transit Alerts
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 640 }}>
            Automated arrival geofence alerts, boarding updates, and operational transit broadcasts.
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
            <Shield size={16} style={{ color: '#2563eb' }} />
            <span>{pagination.unread} Unread Alerts</span>
          </div>

          {pagination.unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="primary-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 18px',
                fontSize: 13.5,
                fontWeight: 700,
              }}
            >
              {markingAll ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCheck size={16} strokeWidth={2.5} />
              )}
              <span>Mark All as Read</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: 8,
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: activeFilter === 'ALL' ? '#2563eb' : 'transparent',
            color: activeFilter === 'ALL' ? '#ffffff' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          <span>All Broadcasts</span>
          <span
            style={{
              background: activeFilter === 'ALL' ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
              color: activeFilter === 'ALL' ? '#ffffff' : '#475569',
              padding: '1px 6px',
              borderRadius: 9999,
              fontSize: 11,
            }}
          >
            {pagination.total}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('UNREAD')}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: activeFilter === 'UNREAD' ? '#2563eb' : 'transparent',
            color: activeFilter === 'UNREAD' ? '#ffffff' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          <span>Unread</span>
          <span
            style={{
              background: activeFilter === 'UNREAD' ? 'rgba(255,255,255,0.2)' : '#fef2f2',
              color: activeFilter === 'UNREAD' ? '#ffffff' : '#b91c1c',
              padding: '1px 6px',
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {pagination.unread}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('STOPS')}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: activeFilter === 'STOPS' ? '#2563eb' : 'transparent',
            color: activeFilter === 'STOPS' ? '#ffffff' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          <MapPin size={13} />
          <span>Geofence Stops</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('TRANSIT')}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: activeFilter === 'TRANSIT' ? '#2563eb' : 'transparent',
            color: activeFilter === 'TRANSIT' ? '#ffffff' : '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
        >
          <Bus size={13} />
          <span>Transit Lifecycle</span>
        </button>
      </div>

      {/* ── Error Banner ── */}
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
          <button
            type="button"
            onClick={() => fetchNotifications(1)}
            style={{
              marginLeft: 'auto',
              background: '#ffffff',
              border: '1px solid #fecaca',
              padding: '3px 10px',
              borderRadius: 6,
              color: '#991b1b',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Notification List ── */}
      {loading && notifications.length === 0 ? (
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
          <span style={{ fontSize: 14, fontWeight: 500 }}>Retrieving safety telemetry broadcasts…</span>
        </div>
      ) : filteredNotifications.length === 0 ? (
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
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
            }}
          >
            <BellOff size={24} />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
            No Broadcasts Found
          </h3>
          <p style={{ fontSize: 13.5, color: '#64748b', margin: 0, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
            {activeFilter !== 'ALL'
              ? 'There are no notifications matching the selected filter category.'
              : 'You will receive immediate automated push alerts when your assigned school bus arrives at designated student stops.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredNotifications.map((notif) => (
            <NotificationCard key={notif.id} notif={notif} onMarkRead={handleMarkRead} />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {pagination.total > pagination.limit && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Showing {notifications.length} of {pagination.total} alerts
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={pagination.page <= 1}
              onClick={() => fetchNotifications(pagination.page - 1)}
              style={{ padding: '6px 14px', fontSize: 12.5 }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
              Page {pagination.page}
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={pagination.page * pagination.limit >= pagination.total}
              onClick={() => fetchNotifications(pagination.page + 1)}
              style={{ padding: '6px 14px', fontSize: 12.5 }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
