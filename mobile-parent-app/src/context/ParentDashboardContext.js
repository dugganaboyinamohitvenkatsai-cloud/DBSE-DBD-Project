import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AppState } from 'react-native';
import { fetchParentDashboard } from '../api/parentApi';
import {
  fetchParentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notificationApi';
import { useAuth } from './AuthContext';

const ParentDashboardContext = createContext(null);

export function ParentDashboardProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);

  const pollIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const refreshData = useCallback(async (isManual = false) => {
    if (!isAuthenticated) return;

    if (isManual) {
      setIsRefreshing(true);
    }

    try {
      // 1. Fetch live parent dashboard data
      const data = await fetchParentDashboard();
      setDashboard(data);
      setError(null);
      setIsOffline(false);

      // 2. Fetch notifications list & unread count
      const notifRes = await fetchParentNotifications(1, 30).catch(() => null);
      if (notifRes?.notifications) {
        setNotifications(notifRes.notifications);
      }
      if (notifRes?.pagination?.unread !== undefined) {
        setUnreadCount(Number(notifRes.pagination.unread));
      }
    } catch (err) {
      console.warn('[ParentContext] Dashboard refresh note:', err.message);
      setError(err.message || 'Unable to connect to school transportation server.');
      setIsOffline(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  // 1. Manage 10-second lifecycle-aware polling
  useEffect(() => {
    if (!isAuthenticated) {
      setDashboard(null);
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    // Initial immediate fetch
    refreshData(false);

    // Start 10s foreground polling interval
    function startPolling() {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(() => {
        refreshData(false);
      }, 10000);
    }

    function stopPolling() {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    startPolling();

    // AppState listener: Pause in background, resume + immediate refresh on foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[ParentContext] Returned to foreground • refreshing immediately.');
        refreshData(false);
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('[ParentContext] Backgrounded • pausing 10s polling to conserve battery.');
        stopPolling();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [isAuthenticated, refreshData]);

  // 2. Normalize Students list
  const students = useMemo(() => {
    if (!dashboard?.children || !Array.isArray(dashboard.children)) return [];
    return dashboard.children.map((c, idx) => ({
      ...c.student,
      id: c.student?.student_id || c.student?.id || idx + 1,
      route_name: c.transport?.trip?.route_name,
      pickup_stop_name: c.transport?.pickup_stop?.name,
      dropoff_stop_name: c.transport?.dropoff_stop?.name,
      bus_registration_number: c.transport?.bus?.registration_number,
      driver_name: c.transport?.driver?.name,
      driver_phone: c.transport?.driver?.phone,
      seat_number: c.transport?.seat_number || c.student?.seat_number || null,
      transport: c.transport,
    }));
  }, [dashboard]);

  const activeChild = students[selectedChildIndex] || students[0] || null;
  const activeChildId = activeChild?.id || null;

  // 3. Normalize Active Student Status (trip, bus, telemetry, journey waypoints)
  const activeStudentStatus = useMemo(() => {
    const entry = dashboard?.children?.[selectedChildIndex] || dashboard?.children?.[0];
    if (!entry) return null;

    return {
      student: activeChild,
      seat_number: entry.transport?.seat_number || entry.student?.seat_number || activeChild?.seat_number || null,
      trip: entry.transport?.trip,
      bus: entry.transport?.bus,
      driver: entry.transport?.driver,
      location: entry.transport?.location,
      progress: entry.transport?.journey,
      journey: entry.transport?.journey,
      transport: entry.transport,
    };
  }, [dashboard, selectedChildIndex, activeChild]);

  // 4. Switch Child handler
  const switchChild = useCallback((childId) => {
    const idx = students.findIndex((s) => s.id === childId || s.student_id === childId);
    if (idx !== -1) {
      setSelectedChildIndex(idx);
    }
  }, [students]);

  // 5. Mark notification as read
  const markNotificationAsRead = useCallback(async (notifId) => {
    try {
      await markNotificationRead(notifId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('[ParentContext] Mark read note:', err.message);
    }
  }, []);

  // 6. Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: 1 }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.warn('[ParentContext] Mark all read note:', err.message);
    }
  }, []);

  return (
    <ParentDashboardContext.Provider
      value={{
        dashboard,
        students,
        activeChild,
        activeChildId,
        activeStudentStatus,
        selectedChildIndex,
        notifications,
        unreadCount,
        isLoading,
        isRefreshing,
        error,
        isOffline,
        refreshDashboard: refreshData,
        switchChild,
        markNotificationAsRead,
        markAllNotificationsAsRead,
      }}
    >
      {children}
    </ParentDashboardContext.Provider>
  );
}

export function useParentDashboard() {
  const context = useContext(ParentDashboardContext);
  if (!context) {
    throw new Error('useParentDashboard must be used within a ParentDashboardProvider');
  }
  return context;
}
