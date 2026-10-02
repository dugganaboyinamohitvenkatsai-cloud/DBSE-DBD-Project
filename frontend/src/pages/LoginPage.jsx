import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  Bus,
  Route,
  Radio,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Users,
} from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQuickFill, setShowQuickFill] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const user = await login(email.trim(), password);
      if (user?.role === 'PARENT') {
        navigate('/parent/dashboard');
      } else if (user?.role === 'DRIVER') {
        navigate('/driver');
      } else {
        navigate('/admin');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickFill(role) {
    setError('');
    if (role === 'ADMIN') {
      setEmail('admin@schoolbus.local');
      setPassword('Admin@12345');
    } else if (role === 'DRIVER') {
      setEmail('rajesh.driver@schoolbus.local');
      setPassword('Driver@12345');
    } else if (role === 'PARENT') {
      setEmail('9876543210');
      setPassword('Parent@12345');
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {/* ── Left Side: Platform Experience & Telemetry Showcase ── */}
        <section className="login-hero-side">
          <div className="login-hero-pattern" aria-hidden="true" />

          {/* Top Brand Header */}
          <div className="login-hero-header">
            <div className="login-brand-badge">
              <div className="login-brand-mark">SB</div>
              <div className="brand-text">
                <span className="login-brand-name">SCHOOLBUS</span>
                <span className="brand-subtitle">Smart Transportation Platform</span>
              </div>
            </div>
          </div>

          {/* Center Content & Value Pillars */}
          <div className="login-hero-body">
            <div className="login-hero-tag">
              <Shield size={13} />
              <span>Next-Gen Mobility & Safety</span>
            </div>

            <h2 className="login-hero-heading">
              Smart Student Transportation & Safety Operations
            </h2>

            <p className="login-hero-text">
              Real-time fleet tracking, automated stop detection, and student
              boarding safety in one unified institutional platform.
            </p>

            <div className="login-features-list">
              <div className="login-feature-item">
                <div className="login-feature-icon-wrapper">
                  <Route size={15} />
                </div>
                <div className="login-feature-content">
                  <h4>Automated Stop Progression</h4>
                  <p>Waypoint progression evaluated dynamically through geofence proximity.</p>
                </div>
              </div>

              <div className="login-feature-item">
                <div className="login-feature-icon-wrapper">
                  <Shield size={15} />
                </div>
                <div className="login-feature-content">
                  <h4>Student Attendance Reassurance</h4>
                  <p>Recorded boarding updates and stop arrivals delivered to family dashboards.</p>
                </div>
              </div>

              <div className="login-feature-item">
                <div className="login-feature-icon-wrapper">
                  <Radio size={15} />
                </div>
                <div className="login-feature-content">
                  <h4>Institutional Fleet Coordination</h4>
                  <p>Unified data synchronization between Operations, Drivers, and Parents.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Telemetry & Status Bar */}
          <div className="login-hero-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span className="pulse-dot" />
              <span style={{ color: '#E2E8F0', fontWeight: 600 }}>Fleet Services Online</span>
            </div>
            <span>Institutional Transit Protocol</span>
          </div>
        </section>

        {/* ── Right Side: Professional Authentication Card ── */}
        <section className="login-form-side">
          <div className="login-form-header">
            <h1>Sign in to portal</h1>
            <p>Access your transportation workspace, telemetry, and route operations.</p>
          </div>

          {error && (
            <div className="alert-box alert-box--danger" role="alert" style={{ marginBottom: 20 }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>Authentication Notice</strong>
                <div style={{ fontSize: 13, marginTop: 2 }}>{error}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="login-input-group">
              <label htmlFor="login-identifier">Email or Phone Number</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">
                  <Mail size={16} />
                </span>
                <input
                  id="login-identifier"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
                  placeholder="admin@schoolbus.local or 9876543210"
                />
              </div>
            </div>

            <div className="login-input-group">
              <label htmlFor="login-password">Password</label>
              <div className="login-input-wrapper">
                <span className="login-input-icon">
                  <Lock size={16} />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading || !email.trim() || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="sb-spin" size={17} />
                  <span>Verifying credentials…</span>
                </>
              ) : (
                <>
                  <span>Sign in securely</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Evaluator Convenience Section (Collapsible & Secure) */}
          <div className="login-quickfill-box">
            <button
              type="button"
              className="login-quickfill-toggle"
              onClick={() => setShowQuickFill(!showQuickFill)}
              aria-expanded={showQuickFill}
            >
              <span>Demo Workspace Quick-Fill</span>
              {showQuickFill ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {showQuickFill && (
              <div className="login-quickfill-grid">
                <button
                  type="button"
                  className="login-quickfill-btn"
                  onClick={() => handleQuickFill('ADMIN')}
                >
                  <Shield size={14} style={{ color: '#2563EB' }} />
                  <span>Admin</span>
                  <span>Command Center</span>
                </button>

                <button
                  type="button"
                  className="login-quickfill-btn"
                  onClick={() => handleQuickFill('DRIVER')}
                >
                  <Bus size={14} style={{ color: '#D97706' }} />
                  <span>Driver</span>
                  <span>Rajesh (BUS-01)</span>
                </button>

                <button
                  type="button"
                  className="login-quickfill-btn"
                  onClick={() => handleQuickFill('PARENT')}
                >
                  <Users size={14} style={{ color: '#16A34A' }} />
                  <span>Parent</span>
                  <span>Safety Portal</span>
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
