import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bus, Navigation, RotateCw, MapPin, Maximize2, ShieldAlert } from 'lucide-react';

function isValidGeoCoord(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const nLat = Number(lat);
  const nLon = Number(lng);
  if (isNaN(nLat) || isNaN(nLon)) return false;
  if (nLat === 0 && nLon === 0) return false; // Reject (0,0) Null Island
  return nLat >= -90 && nLat <= 90 && nLon >= -180 && nLon <= 180;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Creates custom HTML Leaflet Icon for the School Bus
 */
function createSchoolBusIcon(busNumber, bearing = 0, isStale = false) {
  const rotationStyle = bearing ? `transform: rotate(${bearing}deg);` : '';
  const pulseClass = isStale ? '' : 'bus-pulse-ring';

  const html = `
    <div class="school-bus-marker-wrapper" style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      ${!isStale ? '<div class="bus-radar-pulse"></div>' : ''}
      <div style="
        width: 38px;
        height: 38px;
        background: #f59e0b;
        border: 2px solid #ffffff;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
        ${rotationStyle}
        transition: transform 0.4s ease;
      ">
        <!-- Bus windshield / top bar -->
        <div style="width: 28px; height: 5px; background: #1e293b; border-radius: 2px; margin-bottom: 2px;"></div>
        <!-- Bus Body Details -->
        <div style="display: flex; gap: 3px; margin-bottom: 2px;">
          <div style="width: 5px; height: 5px; background: #38bdf8; border-radius: 1px;"></div>
          <div style="width: 5px; height: 5px; background: #38bdf8; border-radius: 1px;"></div>
          <div style="width: 5px; height: 5px; background: #38bdf8; border-radius: 1px;"></div>
        </div>
        <!-- Bus Label -->
        <div style="font-size: 8px; font-weight: 900; color: #000000; font-family: sans-serif; letter-spacing: -0.5px; line-height: 8px;">
          BUS
        </div>
      </div>
      <div style="
        position: absolute;
        bottom: -18px;
        background: #0f172a;
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
        padding: 1px 6px;
        border-radius: 4px;
        white-space: nowrap;
        box-shadow: 0 2px 4px rgba(0,0,0,0.25);
        border: 1px solid #334155;
      ">
        ${busNumber || 'Bus'}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-bus-leaflet-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}

/**
 * Creates custom HTML Leaflet Icon for a Waypoint Stop
 */
function createStopIcon(order, status) {
  let bg = '#475569'; // Upcoming
  let border = '#334155';
  let iconContent = `${order}`;

  if (status === 'COMPLETED' || status === 'REACHED') {
    bg = '#16a34a'; // Green Reached
    border = '#15803d';
    iconContent = '✓';
  } else if (status === 'CURRENT') {
    bg = '#2563eb'; // Blue Current
    border = '#1d4ed8';
    iconContent = `${order}`;
  }

  const html = `
    <div style="
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: ${bg};
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      font-family: sans-serif;
    ">
      ${iconContent}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-stop-leaflet-icon',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

/**
 * Production-Grade Interactive Live Route Map Component
 */
export function LiveRouteMap({
  stops = [],
  location = null,
  busNumber = 'Bus',
  routeGeometry = null,
  height = '420px',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const busMarkerRef = useRef(null);
  const stopsLayerRef = useRef(null);
  const routePolylineRef = useRef(null);

  const prevLocationRef = useRef(null);
  const userPannedRef = useRef(false);

  const [isFollowingBus, setIsFollowingBus] = useState(true);
  const [currentBearing, setCurrentBearing] = useState(0);

  const validStops = (stops || []).filter((s) => isValidGeoCoord(s.latitude, s.longitude));
  const hasValidBusGps = isValidGeoCoord(location?.latitude, location?.longitude);

  // 1. Initialize Map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = hasValidBusGps
        ? Number(location.latitude)
        : validStops.length > 0
        ? Number(validStops[0].latitude)
        : 17.385;
      const initialLng = hasValidBusGps
        ? Number(location.longitude)
        : validStops.length > 0
        ? Number(validStops[0].longitude)
        : 78.4867;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      // Add zoom control at top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Add high-clarity OpenStreetMap Tile Layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Add clean attribution at bottom-right
      L.control
        .attribution({ position: 'bottomright', prefix: false })
        .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>')
        .addTo(map);

      // Detect manual user pans to prevent fighting the user
      map.on('dragstart', () => {
        userPannedRef.current = true;
        setIsFollowingBus(false);
      });

      mapInstanceRef.current = map;
      stopsLayerRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        busMarkerRef.current = null;
        stopsLayerRef.current = null;
        routePolylineRef.current = null;
      }
    };
  }, []);

  // 2. Update Stop Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const stopsLayer = stopsLayerRef.current;
    if (!map || !stopsLayer) return;

    stopsLayer.clearLayers();

    validStops.forEach((stop, idx) => {
      const lat = Number(stop.latitude);
      const lng = Number(stop.longitude);
      const order = stop.stop_order ?? idx + 1;
      const isReached = stop.isReached || stop.status === 'COMPLETED';
      const isCurrent = stop.status === 'CURRENT';

      let status = 'UPCOMING';
      if (isReached) status = 'REACHED';
      else if (isCurrent) status = 'CURRENT';

      const icon = createStopIcon(order, status);
      const marker = L.marker([lat, lng], { icon });

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; min-width: 170px;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">
            Stop #${order} • ${status}
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin: 3px 0 6px;">
            ${stop.name}
          </div>
          ${
            stop.scheduled_time
              ? `<div style="font-size: 12px; color: #475569;">⏰ Scheduled: <strong>${stop.scheduled_time}</strong></div>`
              : ''
          }
          ${
            stop.reached_at
              ? `<div style="font-size: 12px; color: #16a34a;">✓ Reached at: <strong>${new Date(stop.reached_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>`
              : ''
          }
        </div>
      `;

      marker.bindPopup(popupContent);
      stopsLayer.addLayer(marker);
    });
  }, [stops]);

  // 3. Update Road-Based Polyline Geometry
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    let latLngs = [];

    // Prefer road geometry from routing service (OSRM / Google)
    if (routeGeometry && Array.isArray(routeGeometry.coordinates) && routeGeometry.coordinates.length > 0) {
      latLngs = routeGeometry.coordinates;
    } else if (validStops.length >= 2) {
      // Fallback: connect valid stop coordinates directly
      latLngs = validStops.map((s) => [Number(s.latitude), Number(s.longitude)]);
    }

    if (latLngs.length >= 2) {
      const polyline = L.polyline(latLngs, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      routePolylineRef.current = polyline;
    }
  }, [routeGeometry, stops]);

  // 4. Update Bus Location Marker & Heading
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!hasValidBusGps) {
      if (busMarkerRef.current) {
        map.removeLayer(busMarkerRef.current);
        busMarkerRef.current = null;
      }
      return;
    }

    const curLat = Number(location.latitude);
    const curLng = Number(location.longitude);
    const isStale = Boolean(location.is_stale);

    // Compute bearing if previous position exists
    let bearing = currentBearing;
    if (prevLocationRef.current) {
      const pLat = Number(prevLocationRef.current.latitude);
      const pLng = Number(prevLocationRef.current.longitude);
      if (Math.abs(curLat - pLat) > 0.00005 || Math.abs(curLng - pLng) > 0.00005) {
        bearing = calculateBearing(pLat, pLng, curLat, curLng);
        setCurrentBearing(bearing);
      }
    }
    prevLocationRef.current = { latitude: curLat, longitude: curLng };

    const busIcon = createSchoolBusIcon(busNumber, bearing, isStale);

    if (!busMarkerRef.current) {
      const marker = L.marker([curLat, curLng], { icon: busIcon, zIndexOffset: 1000 }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif;">
          <div style="font-size: 11px; font-weight: 700; color: #2563eb;">LIVE TELEMETRY</div>
          <div style="font-size: 15px; fontWeight: 800; color: #0f172a; margin: 2px 0 4px;">
            ${busNumber || 'School Bus'}
          </div>
          <div style="font-size: 12px; color: #475569;">
            GPS: ${curLat.toFixed(5)}, ${curLng.toFixed(5)}
          </div>
          ${location.accuracy ? `<div style="font-size: 11px; color: #64748b;">Accuracy: ±${Math.round(location.accuracy)}m</div>` : ''}
          ${isStale ? '<div style="font-size: 11px; color: #b45309; font-weight: 700; margin-top: 4px;">⚠️ Signal Stale</div>' : '<div style="font-size: 11px; color: #16a34a; font-weight: 700; margin-top: 4px;">● Live Tracking Active</div>'}
        </div>
      `);
      busMarkerRef.current = marker;
    } else {
      busMarkerRef.current.setLatLng([curLat, curLng]);
      busMarkerRef.current.setIcon(busIcon);
    }

    // Auto-center on bus if user has not manually panned away
    if (isFollowingBus && !userPannedRef.current) {
      map.panTo([curLat, curLng], { animate: true, duration: 0.8 });
    }
  }, [location, busNumber, isFollowingBus, hasValidBusGps]);

  // Center on Bus action
  const handleCenterBus = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !hasValidBusGps) return;
    userPannedRef.current = false;
    setIsFollowingBus(true);
    map.setView([Number(location.latitude), Number(location.longitude)], 15, {
      animate: true,
      duration: 0.6,
    });
  }, [hasValidBusGps, location]);

  // Fit Entire Route action
  const handleFitRoute = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    userPannedRef.current = true;
    setIsFollowingBus(false);

    const bounds = L.latLngBounds([]);
    validStops.forEach((s) => bounds.extend([Number(s.latitude), Number(s.longitude)]));
    if (hasValidBusGps) {
      bounds.extend([Number(location.latitude), Number(location.longitude)]);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [validStops, hasValidBusGps, location]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
      {/* Map Header Status Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasValidBusGps ? (
            location?.is_stale ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '3px 10px', borderRadius: 9999, border: '1px solid #fde68a' }}>
                <ShieldAlert size={13} />
                <span>GPS Signal Stale ({location.age_seconds || 60}s ago)</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '3px 10px', borderRadius: 9999, border: '1px solid #bbf7d0' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 2px #bbf7d0' }} />
                <span>Live GPS Signal Active • {busNumber}</span>
              </span>
            )
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#475569', background: '#f1f5f9', padding: '3px 10px', borderRadius: 9999, border: '1px solid #e2e8f0' }}>
              <Navigation size={13} />
              <span>Awaiting Driver GPS Broadcast</span>
            </span>
          )}

          {routeGeometry?.is_road_following && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 6, border: '1px solid #bfdbfe' }}>
              🛣️ Road-Following Geometry
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 8 }}>
          {hasValidBusGps && (
            <button
              type="button"
              className="table-action-button"
              onClick={handleCenterBus}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                padding: '4px 10px',
                background: isFollowingBus ? '#2563eb' : '#ffffff',
                color: isFollowingBus ? '#ffffff' : '#1e293b',
                borderColor: isFollowingBus ? '#2563eb' : '#cbd5e1',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Recenter and follow bus GPS"
            >
              <Navigation size={12} />
              <span>Center on Bus</span>
            </button>
          )}

          <button
            type="button"
            className="table-action-button"
            onClick={handleFitRoute}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              padding: '4px 10px',
              background: '#ffffff',
              color: '#334155',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Fit full route in viewport"
          >
            <Maximize2 size={12} />
            <span>Fit Route</span>
          </button>
        </div>
      </div>

      {/* Leaflet DOM Map Container */}
      <div
        style={{
          width: '100%',
          height,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1.5px solid #cbd5e1',
          position: 'relative',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

        {/* Waiting GPS Overlay Banner if no GPS */}
        {!hasValidBusGps && (
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(4px)',
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              fontSize: 12,
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <MapPin size={14} color="#2563eb" />
            <span>Showing designated waypoint stops. Bus marker will appear when driver starts broadcast.</span>
          </div>
        )}
      </div>

      {/* CSS Styles for Radar Pulse & DivIcons */}
      <style>{`
        .custom-bus-leaflet-icon {
          background: transparent !important;
          border: none !important;
        }
        .custom-stop-leaflet-icon {
          background: transparent !important;
          border: none !important;
        }
        .bus-radar-pulse {
          position: absolute;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.25);
          animation: busPulse 2s infinite ease-out;
          pointer-events: none;
        }
        @keyframes busPulse {
          0% {
            transform: scale(0.6);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
export default LiveRouteMap;
