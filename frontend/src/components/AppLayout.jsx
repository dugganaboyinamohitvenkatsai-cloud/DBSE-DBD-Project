import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Navigation,
  Armchair,
  Route,
  Bus,
  UserCheck,
  GraduationCap,
  Users,
  CalendarClock,
  Radio,
  ClipboardCheck,
  Bell,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronRight,
  MapPin,
} from 'lucide-react';

const navConfigByRole = {
  ADMIN: {
    sectionTitle: 'Operations Hub',
    roleLabel: 'Admin Console',
    roleClass: 'role-pill--admin',
    roleIcon: Shield,
    links: [
      { label: 'Overview', to: '/admin', icon: LayoutDashboard },
      { label: 'Live Trips & Fleet', to: '/admin/trips', icon: Navigation },
      { label: 'Seat Allocations', to: '/admin/seats', icon: Armchair },
      { label: 'Routes & Stops', to: '/admin/routes', icon: Route },
      { label: 'Fleet Buses', to: '/admin/buses', icon: Bus },
      { label: 'Drivers', to: '/admin/drivers', icon: UserCheck },
      { label: 'Students', to: '/admin/students', icon: GraduationCap },
      { label: 'Parents', to: '/admin/parents', icon: Users },
    ],
  },
  DRIVER: {
    sectionTitle: 'Driver Console',
    roleLabel: 'Fleet Driver',
    roleClass: 'role-pill--driver',
    roleIcon: Radio,
    links: [
      { label: 'Overview', to: '/driver', icon: LayoutDashboard },
      { label: 'Today’s Trips', to: '/driver/trips', icon: CalendarClock },
      { label: 'GPS Broadcaster', to: '/driver/location', icon: Radio },
      { label: 'Student Status', to: '/driver/students', icon: ClipboardCheck },
    ],
  },
  PARENT: {
    sectionTitle: 'Safety Portal',
    roleLabel: 'Parent Portal',
    roleClass: 'role-pill--parent',
    roleIcon: Users,
    links: [
      { label: 'Dashboard', to: '/parent/dashboard', icon: LayoutDashboard },
      { label: 'My Children', to: '/parent/students', icon: GraduationCap },
      { label: 'Track School Bus', to: '/parent/tracking', icon: MapPin },
      { label: 'Notifications', to: '/parent/notifications', icon: Bell },
    ],
  },
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roleConfig = navConfigByRole[user?.role] || navConfigByRole.ADMIN;
  const RoleIcon = roleConfig.roleIcon;

  const handleSignOut = () => {
    logout();
    navigate('/login');
  };

  // Derive breadcrumb label from current path
  const currentLink = roleConfig.links.find(
    (link) => link.to === location.pathname
  );
  const breadcrumbCurrent = currentLink ? currentLink.label : 'Workspace';

  return (
    <div className="app-shell">
      {/* Mobile Drawer Overlay Backdrop */}
      <div
        className={`sidebar-backdrop ${mobileOpen ? 'mobile-open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ── Professional Transportation Operations Sidebar ── */}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-mark">SB</div>
            <div className="brand-text">
              <span className="brand-title">SCHOOLBUS</span>
              <span className="brand-subtitle">Safety & Fleet Platform</span>
            </div>
          </div>
        </div>

        <div className="sidebar-nav-container">
          <div>
            <div className="sidebar-section-title">{roleConfig.sectionTitle}</div>
            <nav>
              {roleConfig.links.map(({ label, to, icon: IconComponent }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to.split('/').length === 2}
                  onClick={() => setMobileOpen(false)}
                >
                  <IconComponent className="nav-item-icon" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="system-status-indicator">
            <span className="pulse-dot" />
            <span>Telemetry Operational</span>
          </div>

          <div className="sidebar-user-card">
            <div className="sidebar-user-info">
              <div className="user-avatar-sm">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#FFFFFF',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user?.full_name || 'Logged User'}
                </span>
                <span style={{ fontSize: 10.5, color: '#64748B' }}>
                  {roleConfig.roleLabel}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="sign-out"
              onClick={handleSignOut}
              title="Sign out of portal"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Canvas & Header ── */}
      <div className="main-wrapper">
        <header className="top-bar">
          <div className="top-bar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div className="breadcrumbs">
              <span>{roleConfig.roleLabel}</span>
              <ChevronRight className="breadcrumbs-separator" size={14} />
              <span className="breadcrumbs-current">{breadcrumbCurrent}</span>
            </div>
          </div>

          <div className="top-bar-right">
            <span className={`role-pill ${roleConfig.roleClass}`}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <RoleIcon size={12} />
                {user?.role || 'USER'}
              </span>
            </span>

            {user?.role === 'PARENT' && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => navigate('/parent/notifications')}
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell size={18} />
              </button>
            )}

            <div className="header-user-badge">
              <div className="user-avatar-sm">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="user-name-label">{user?.full_name}</span>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleSignOut}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
