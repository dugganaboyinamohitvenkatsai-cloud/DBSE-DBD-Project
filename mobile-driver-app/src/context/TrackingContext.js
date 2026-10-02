import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { flushTelemetryQueue, getQueueLength, queueLocationPoint } from '../services/telemetryQueue';
import { fetchActiveTrip, submitDriverLocation } from '../api/tripApi';
import { useAuth } from './AuthContext';

const TrackingContext = createContext(null);

export const TRACKING_STATES = {
  TRIP_NOT_ACTIVE: 'TRIP NOT ACTIVE',
  READY_TO_START: 'READY TO START',
  STARTING_GPS: 'STARTING GPS',
  GPS_SEARCHING: 'GPS SEARCHING',
  GPS_CONNECTED: 'GPS CONNECTED',
  TRACKING_LIVE: 'TRACKING LIVE',
  STOP_APPROACHING: 'STOP APPROACHING',
  STOP_REACHED: 'STOP REACHED',
  NETWORK_OFFLINE: 'NETWORK OFFLINE',
  LOCATION_STALE: 'LOCATION STALE',
  LOW_GPS_ACCURACY: 'LOW GPS ACCURACY',
  LOCATION_PERMISSION_REQUIRED: 'LOCATION PERMISSION REQUIRED',
  TRIP_COMPLETED: 'TRIP COMPLETED',
};

export function TrackingProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [activeTrip, setActiveTrip] = useState(null);
  const [scheduledTrip, setScheduledTrip] = useState(null);
  const [trackingState, setTrackingState] = useState(TRACKING_STATES.TRIP_NOT_ACTIVE);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastUploadedAt, setLastUploadedAt] = useState(null);
  const [nextStop, setNextStop] = useState(null);
  const [recentStopEvent, setRecentStopEvent] = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [isTrackingActive, setIsTrackingActive] = useState(false);

  const watchIdRef = useRef(null);
  const lastCoordRef = useRef(null);
  const staleTimerRef = useRef(null);

  // 1. Initial active trip sync on launch
  async function refreshTripState() {
    try {
      const data = await fetchActiveTrip();
      if (data.activeTrip) {
        setActiveTrip(data.activeTrip);
        setIsTrackingActive(true);
        if (trackingState === TRACKING_STATES.TRIP_NOT_ACTIVE) {
          setTrackingState(TRACKING_STATES.GPS_SEARCHING);
        }
        // Resolve next unreached stop
        const unreached = (data.activeTrip.stops || []).find((s) => !s.is_reached);
        setNextStop(unreached || null);
      } else {
        setActiveTrip(null);
        setIsTrackingActive(false);
        setTrackingState(data.scheduledTrip ? TRACKING_STATES.READY_TO_START : TRACKING_STATES.TRIP_NOT_ACTIVE);
      }
      setScheduledTrip(data.scheduledTrip || null);
    } catch (err) {
      console.warn('[TrackingContext] Failed to refresh trip state:', err.message);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveTrip(null);
      setScheduledTrip(null);
      setIsTrackingActive(false);
      setTrackingState(TRACKING_STATES.TRIP_NOT_ACTIVE);
      return;
    }

    refreshTripState();
  }, [isAuthenticated]);

  // 2. Watchdog to detect stale GPS (> 60 seconds without valid coordinates)
  useEffect(() => {
    if (!isTrackingActive) return;

    const interval = setInterval(() => {
      if (lastCoordRef.current?.timestamp) {
        const ageSec = (Date.now() - new Date(lastCoordRef.current.timestamp).getTime()) / 1000;
        if (ageSec > 60 && trackingState !== TRACKING_STATES.LOCATION_STALE && trackingState !== TRACKING_STATES.NETWORK_OFFLINE) {
          setTrackingState(TRACKING_STATES.LOCATION_STALE);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isTrackingActive, trackingState]);

  // 3. Process new incoming GPS position
  async function ingestRawLocation(position) {
    if (!position || !position.coords) return;
    const { latitude, longitude, accuracy } = position.coords;
    const timestamp = new Date(position.timestamp || Date.now()).toISOString();

    // Sanity check: Discard invalid Null Island (0,0) or coordinates outside bounds
    if (
      (latitude === 0 && longitude === 0) ||
      latitude < -90 || latitude > 90 ||
      longitude < -180 || longitude > 180
    ) {
      console.warn('[TrackingContext] Discarded invalid GPS coordinates:', latitude, longitude);
      return;
    }

    // Check accuracy
    if (accuracy && accuracy > 80) {
      setTrackingState(TRACKING_STATES.LOW_GPS_ACCURACY);
      setCurrentLocation({ latitude, longitude, accuracy, timestamp });
      return;
    }

    setCurrentLocation({ latitude, longitude, accuracy, timestamp });
    lastCoordRef.current = { latitude, longitude, accuracy, timestamp };

    if (!activeTrip?.id) return;

    // Transmit to backend
    try {
      const res = await submitDriverLocation({
        latitude,
        longitude,
        accuracy: accuracy ? Math.round(accuracy) : null,
        timestamp,
        trip_id: activeTrip.id,
      });

      setTrackingState(TRACKING_STATES.TRACKING_LIVE);
      setLastUploadedAt(new Date());

      // If stop reached event triggered
      if (res?.stop_event?.stop) {
        setRecentStopEvent(res.stop_event.stop);
        setTrackingState(TRACKING_STATES.STOP_REACHED);
        setTimeout(() => {
          setTrackingState(TRACKING_STATES.TRACKING_LIVE);
        }, 6000);
      }

      // Check if any points queued in buffer can now be flushed
      if (getQueueLength() > 0) {
        const { remaining } = await flushTelemetryQueue();
        setQueueCount(remaining);
      }
    } catch (err) {
      console.warn('[TrackingContext] Location upload failed, queueing offline point:', err.message);
      queueLocationPoint({
        latitude,
        longitude,
        accuracy,
        timestamp,
        trip_id: activeTrip.id,
      });
      setQueueCount(getQueueLength());
      setTrackingState(TRACKING_STATES.NETWORK_OFFLINE);
    }
  }

  // 4. Start tracking session
  function startTrackingSession(trip) {
    setActiveTrip(trip);
    setIsTrackingActive(true);
    setTrackingState(TRACKING_STATES.STARTING_GPS);

    // In React Native / mobile web, subscribe to position watch
    if (navigator?.geolocation?.watchPosition) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => ingestRawLocation(pos),
        (err) => {
          console.warn('[Geolocation Error]:', err.message);
          if (err.code === 1) {
            setTrackingState(TRACKING_STATES.LOCATION_PERMISSION_REQUIRED);
          } else {
            setTrackingState(TRACKING_STATES.GPS_SEARCHING);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 4000,
        }
      );
    }
  }

  // 5. Stop tracking session on trip completion
  function stopTrackingSession() {
    if (watchIdRef.current !== null && navigator?.geolocation?.clearWatch) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTrackingActive(false);
    setTrackingState(TRACKING_STATES.TRIP_COMPLETED);
    setTimeout(() => {
      setTrackingState(TRACKING_STATES.TRIP_NOT_ACTIVE);
      setActiveTrip(null);
    }, 4000);
  }

  return (
    <TrackingContext.Provider
      value={{
        activeTrip,
        scheduledTrip,
        trackingState,
        setTrackingState,
        currentLocation,
        lastUploadedAt,
        nextStop,
        recentStopEvent,
        queueCount,
        isTrackingActive,
        refreshTripState,
        startTrackingSession,
        stopTrackingSession,
        ingestRawLocation,
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
}
