import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Navigation, Maximize2, MapPin, ShieldAlert, Bus } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../constants/theme';

function isValidGeoCoord(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const nLat = Number(lat);
  const nLon = Number(lng);
  if (isNaN(nLat) || isNaN(nLon)) return false;
  if (nLat === 0 && nLon === 0) return false;
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

export function LiveTrackingMapView({
  stops = [],
  location = null,
  busNumber = 'School Bus',
  routeGeometry = null,
  isLive = false,
  onStopSelect = null,
}) {
  const webViewRef = useRef(null);
  const prevLocationRef = useRef(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isFollowingBus, setIsFollowingBus] = useState(true);
  const [currentBearing, setCurrentBearing] = useState(0);

  const hasValidBusGps = isValidGeoCoord(location?.latitude, location?.longitude);
  const validStops = useMemo(
    () => (stops || []).filter((s) => isValidGeoCoord(s.latitude, s.longitude)),
    [stops]
  );

  // Compute movement bearing
  useEffect(() => {
    if (!hasValidBusGps) return;
    const curLat = Number(location.latitude);
    const curLng = Number(location.longitude);

    if (prevLocationRef.current) {
      const pLat = Number(prevLocationRef.current.latitude);
      const pLng = Number(prevLocationRef.current.longitude);
      if (Math.abs(curLat - pLat) > 0.00005 || Math.abs(curLng - pLng) > 0.00005) {
        const brng = calculateBearing(pLat, pLng, curLat, curLng);
        setCurrentBearing(brng);
      }
    }
    prevLocationRef.current = { latitude: curLat, longitude: curLng };
  }, [hasValidBusGps, location?.latitude, location?.longitude]);

  // Initial center coordinates
  const initialCenter = useMemo(() => {
    if (hasValidBusGps) {
      return [Number(location.latitude), Number(location.longitude)];
    }
    if (validStops.length > 0) {
      return [Number(validStops[0].latitude), Number(validStops[0].longitude)];
    }
    return [17.4337, 78.5007]; // Hyderabad center fallback
  }, [hasValidBusGps, location, validStops]);

  // Send update messages to WebView without reloading
  const sendMapMessage = useCallback((action, data = {}) => {
    if (!webViewRef.current) return;
    const payload = JSON.stringify({ action, ...data });
    const jsCode = `
      if (window.handleNativeMapMessage) {
        window.handleNativeMapMessage(${payload});
      }
      true;
    `;
    webViewRef.current.injectJavaScript(jsCode);
  }, []);

  // Update bus position in Leaflet
  useEffect(() => {
    if (!isMapReady) return;
    if (hasValidBusGps) {
      sendMapMessage('UPDATE_BUS', {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        accuracy: location.accuracy || null,
        isStale: Boolean(location.is_stale),
        bearing: currentBearing,
        busNumber,
        isFollowing: isFollowingBus,
      });
    }
  }, [isMapReady, hasValidBusGps, location, currentBearing, busNumber, isFollowingBus, sendMapMessage]);

  // Update stops in Leaflet
  useEffect(() => {
    if (!isMapReady) return;
    sendMapMessage('UPDATE_STOPS', {
      stops: validStops.map((s, idx) => ({
        id: s.id,
        name: s.name,
        order: s.stop_order ?? idx + 1,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        scheduled_time: s.scheduled_time || '',
        reached_at: s.reached_at || null,
        status: s.isReached || s.status === 'COMPLETED' ? 'REACHED' : s.status === 'CURRENT' ? 'CURRENT' : 'UPCOMING',
      })),
    });
  }, [isMapReady, validStops, sendMapMessage]);

  // Update road geometry in Leaflet
  useEffect(() => {
    if (!isMapReady) return;
    let coords = [];
    if (routeGeometry && Array.isArray(routeGeometry.coordinates) && routeGeometry.coordinates.length > 0) {
      coords = routeGeometry.coordinates;
    } else if (validStops.length >= 2) {
      coords = validStops.map((s) => [Number(s.latitude), Number(s.longitude)]);
    }

    sendMapMessage('UPDATE_ROUTE', { coordinates: coords });
  }, [isMapReady, routeGeometry, validStops, sendMapMessage]);

  const handleCenterOnBus = () => {
    setIsFollowingBus(true);
    sendMapMessage('CENTER_BUS');
  };

  const handleFitRoute = () => {
    setIsFollowingBus(false);
    sendMapMessage('FIT_ROUTE');
  };

  // Handle messages from WebView
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_READY') {
        setIsMapReady(true);
      } else if (data.type === 'USER_PAN') {
        setIsFollowingBus(false);
      } else if (data.type === 'STOP_CLICK' && onStopSelect) {
        onStopSelect(data.stop);
      }
    } catch (err) {
      console.warn('[LiveTrackingMap] Message parse err:', err);
    }
  };

  // Embedded Leaflet HTML template
  const leafletHtml = useMemo(() => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        html, body, #map {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          background: #f8fafc;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .custom-bus-icon { background: transparent !important; border: none !important; }
        .custom-stop-icon { background: transparent !important; border: none !important; }
        .bus-pulse {
          position: absolute;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.28);
          animation: radarPulse 2s infinite ease-out;
          pointer-events: none;
        }
        @keyframes radarPulse {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        }
        .leaflet-popup-content {
          margin: 10px 14px;
          line-height: 1.4;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          attributionControl: false
        }).setView([${initialCenter[0]}, ${initialCenter[1]}], 14);

        L.control.zoom({ position: 'topright' }).addTo(map);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        var stopsLayer = L.layerGroup().addTo(map);
        var routePolyline = null;
        var busMarker = null;
        var isFollowing = true;

        map.on('dragstart', function() {
          isFollowing = false;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_PAN' }));
          }
        });

        function createBusIconHtml(busNum, bearing, isStale) {
          var rot = bearing ? 'transform: rotate(' + bearing + 'deg);' : '';
          var pulseHtml = !isStale ? '<div class="bus-pulse"></div>' : '';
          return '<div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">' +
            pulseHtml +
            '<div style="width: 36px; height: 36px; background: #f59e0b; border: 2.5px solid #ffffff; border-radius: 9px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; flex-direction: column; align-items: center; justify-content: center; ' + rot + ' transition: transform 0.4s ease;">' +
              '<div style="width: 24px; height: 4px; background: #1e293b; border-radius: 2px; margin-bottom: 2px;"></div>' +
              '<div style="display: flex; gap: 2px; margin-bottom: 2px;">' +
                '<div style="width: 5px; height: 5px; background: #38bdf8; border-radius: 1px;"></div>' +
                '<div style="width: 5px; height: 5px; background: #38bdf8; border-radius: 1px;"></div>' +
                '<div style="width: 5px; height: 5px; background: #38bdf8; border-radius: 1px;"></div>' +
              '</div>' +
              '<div style="font-size: 8px; font-weight: 900; color: #000; letter-spacing: -0.5px;">BUS</div>' +
            '</div>' +
            '<div style="position: absolute; bottom: -18px; background: #0f172a; color: #fff; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 4px; white-space: nowrap; border: 1px solid #334155;">' +
              (busNum || 'Bus') +
            '</div>' +
          '</div>';
        }

        function createStopIconHtml(order, status) {
          var bg = '#475569';
          var text = order;
          if (status === 'REACHED') {
            bg = '#16a34a';
            text = '✓';
          } else if (status === 'CURRENT') {
            bg = '#2563eb';
            text = order;
          }
          return '<div style="width: 26px; height: 26px; border-radius: 50%; background: ' + bg + '; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: 800;">' + text + '</div>';
        }

        window.handleNativeMapMessage = function(data) {
          if (!data || !data.action) return;

          if (data.action === 'UPDATE_BUS') {
            var iconHtml = createBusIconHtml(data.busNumber, data.bearing, data.isStale);
            var icon = L.divIcon({ html: iconHtml, className: 'custom-bus-icon', iconSize: [44, 44], iconAnchor: [22, 22] });
            var latLng = [data.latitude, data.longitude];

            if (!busMarker) {
              busMarker = L.marker(latLng, { icon: icon, zIndexOffset: 1000 }).addTo(map);
            } else {
              busMarker.setLatLng(latLng);
              busMarker.setIcon(icon);
            }

            if (data.isFollowing && isFollowing) {
              map.panTo(latLng, { animate: true, duration: 0.8 });
            }
          }

          if (data.action === 'UPDATE_STOPS') {
            stopsLayer.clearLayers();
            var bounds = L.latLngBounds([]);

            data.stops.forEach(function(s) {
              var iconHtml = createStopIconHtml(s.order, s.status);
              var icon = L.divIcon({ html: iconHtml, className: 'custom-stop-icon', iconSize: [26, 26], iconAnchor: [13, 13] });
              var marker = L.marker([s.latitude, s.longitude], { icon: icon });

              var popupHtml = '<div>' +
                '<div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Stop #' + s.order + ' • ' + s.status + '</div>' +
                '<div style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 2px 0 4px;">' + s.name + '</div>' +
                (s.scheduled_time ? '<div style="font-size: 11.5px; color: #475569;">⏰ Scheduled: ' + s.scheduled_time + '</div>' : '') +
              '</div>';

              marker.bindPopup(popupHtml);
              marker.on('click', function() {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'STOP_CLICK', stop: s }));
                }
              });
              stopsLayer.addLayer(marker);
              bounds.extend([s.latitude, s.longitude]);
            });

            if (!busMarker && bounds.isValid()) {
              map.fitBounds(bounds, { padding: [40, 40] });
            }
          }

          if (data.action === 'UPDATE_ROUTE') {
            if (routePolyline) {
              map.removeLayer(routePolyline);
              routePolyline = null;
            }
            if (data.coordinates && data.coordinates.length >= 2) {
              routePolyline = L.polyline(data.coordinates, {
                color: '#2563eb',
                weight: 5,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);
            }
          }

          if (data.action === 'CENTER_BUS') {
            isFollowing = true;
            if (busMarker) {
              map.setView(busMarker.getLatLng(), 15, { animate: true, duration: 0.6 });
            }
          }

          if (data.action === 'FIT_ROUTE') {
            isFollowing = false;
            var b = L.latLngBounds([]);
            stopsLayer.eachLayer(function(l) { b.extend(l.getLatLng()); });
            if (busMarker) b.extend(busMarker.getLatLng());
            if (b.isValid()) {
              map.fitBounds(b, { padding: [50, 50], animate: true });
            }
          }
        };

        // Notify React Native that Map DOM is ready
        setTimeout(function() {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
          }
        }, 150);
      </script>
    </body>
    </html>
  `, [initialCenter]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: leafletHtml }}
        style={styles.webView}
        onMessage={handleWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Initializing Live Map…</Text>
          </View>
        )}
        startInLoadingState={true}
      />

      {/* Floating Map Controls */}
      <View style={styles.controlsOverlay}>
        {hasValidBusGps && (
          <TouchableOpacity
            style={[styles.floatingBtn, isFollowingBus ? styles.floatingBtnActive : styles.floatingBtnDefault]}
            onPress={handleCenterOnBus}
            activeOpacity={0.8}
          >
            <Navigation size={14} color={isFollowingBus ? '#FFFFFF' : COLORS.text} />
            <Text style={[styles.floatingBtnText, isFollowingBus ? styles.floatingBtnTextActive : styles.floatingBtnTextDefault]}>
              Center Bus
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.floatingBtn, styles.floatingBtnDefault]}
          onPress={handleFitRoute}
          activeOpacity={0.8}
        >
          <Maximize2 size={14} color={COLORS.text} />
          <Text style={[styles.floatingBtnText, styles.floatingBtnTextDefault]}>Fit Route</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  controlsOverlay: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'column',
    gap: 8,
    zIndex: 20,
  },
  floatingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    ...SHADOWS.md,
  },
  floatingBtnDefault: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  floatingBtnActive: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  floatingBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  floatingBtnTextDefault: {
    color: COLORS.text,
  },
  floatingBtnTextActive: {
    color: '#FFFFFF',
  },
});

export default LiveTrackingMapView;
