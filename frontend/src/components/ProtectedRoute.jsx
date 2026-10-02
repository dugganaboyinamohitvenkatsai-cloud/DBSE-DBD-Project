import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export function ProtectedRoute({ roles }) { const { user, loading } = useAuth(); if (loading) return <div className="page-state">Loading your workspace…</div>; if (!user) return <Navigate to="/login" replace />; if (roles && !roles.includes(user.role)) return <Navigate to={`/${user.role.toLowerCase()}`} replace />; return <Outlet />; }
