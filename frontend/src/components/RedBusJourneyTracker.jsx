import React, { useState } from 'react';
import { LiveRouteMap } from './LiveRouteMap.jsx';

function isValidGeoCoord(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const nLat = Number(lat);
  const nLon = Number(lng);
  if (isNaN(nLat) || isNaN(nLon)) return false;
  if (nLat === 0 && nLon === 0) return false; // Reject (0,0) Null Island
  return nLat >= -90 && nLat <= 90 && nLon >= -180 && nLon <= 180;
}

function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  if (!isValidGeoCoord(lat1, lon1) || !isValidGeoCoord(lat2, lon2)) return null;
  const toRad = (val) => (val * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(6371000 * c);
}

/**
 * RedBus-Style Live Journey Progress Component
 * Displays the ordered sequence of stops with reached (🟢), current (🚌), and upcoming (⚪) states,
 * with a toggleable Live Route Map view.
 */
export function RedBusJourneyTracker({ journey, location, trip, compact = false }) {
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'map'

  if (!journey || !journey.stops || journey.stops.length === 0) {
    return (
      <div className="panel empty-state" style={{ padding: 20 }}>
        <p>No stops configured for this route.</p>
      </div>
    );
  }

  const { total_stops, reached_stops_count, remaining_stops_count, stops } = journey;
  const hasValidGps = isValidGeoCoord(location?.latitude, location?.longitude);

  return (
    <div className="redbus-journey-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Journey Telemetry Banner ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10,
          background: '#f8faff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '12px 16px',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Total Stops
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{total_stops}</div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
            Reached
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>
            🟢 {reached_stops_count}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            Remaining
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#64748b' }}>
            ⚪ {remaining_stops_count}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            GPS Status
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>
            {hasValidGps ? (
              location.is_stale ? (
                <span style={{ color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: 6 }}>
                  🟡 Stale ({location.age_seconds}s ago)
                </span>
              ) : (
                <span style={{ color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>
                  🟢 Live Telemetry
                </span>
              )
            ) : (
              <span style={{ color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 6 }}>
                ⚪ Waiting for live GPS signal
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Live Coordinates Telemetry or Waiting Banner ── */}
      {hasValidGps ? (
        <div
          style={{
            fontSize: 12,
            color: '#475569',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            alignItems: 'center',
          }}
        >
          <span>
            📍 <strong>Lat:</strong> {Number(location.latitude).toFixed(5)}
          </span>
          <span>
            📍 <strong>Lng:</strong> {Number(location.longitude).toFixed(5)}
          </span>
          {location.accuracy !== null && (
            <span>
              🎯 <strong>Accuracy:</strong> ±{Math.round(location.accuracy)}m
            </span>
          )}
          {location.recorded_at && (
            <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
              Updated: {new Date(location.recorded_at).toLocaleTimeString()}
            </span>
          )}
        </div>
      ) : (
        <div
          style={{
            fontSize: 12,
            color: '#64748b',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>📡</span>
          <span>
            <strong>Waiting for live GPS signal</strong> — bus position and stop distances will calculate dynamically when live coordinates arrive.
          </span>
        </div>
      )}

      {/* ── View Mode Switcher ── */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
        <button
          type="button"
          className="table-action-button"
          style={{
            background: activeTab === 'timeline' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'timeline' ? '#ffffff' : '#475569',
            borderColor: activeTab === 'timeline' ? '#2563eb' : '#cbd5e1',
            fontWeight: 700,
            padding: '6px 14px',
          }}
          onClick={() => setActiveTab('timeline')}
        >
          📋 Journey Timeline
        </button>

        <button
          type="button"
          className="table-action-button"
          style={{
            background: activeTab === 'map' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'map' ? '#ffffff' : '#475569',
            borderColor: activeTab === 'map' ? '#2563eb' : '#cbd5e1',
            fontWeight: 700,
            padding: '6px 14px',
          }}
          onClick={() => setActiveTab('map')}
        >
          🗺️ Live Route Map
        </button>
      </div>

      {activeTab === 'map' ? (
        <LiveRouteMap
          stops={stops}
          location={location}
          busNumber={trip?.bus_number || 'Bus'}
          routeGeometry={journey?.route_geometry}
        />
      ) : (
        /* ── RedBus Vertical Stop Timeline ── */
        <div className="redbus-timeline" style={{ padding: '8px 4px' }}>
        {stops.map((stop, index) => {
          const isFirst = index === 0;
          const isLast = index === stops.length - 1;
          const isReached = stop.isReached;
          const isCurrent = stop.status === 'CURRENT';

          // Node styling based on RedBus journey states
          let nodeBg = '#cbd5e1'; // upcoming (gray)
          let nodeBorder = '#94a3b8';
          let nodeIcon = `${stop.stop_order}`;
          let statusBadge = <span style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>Upcoming</span>;

          if (isReached) {
            nodeBg = '#22c55e'; // green reached
            nodeBorder = '#16a34a';
            nodeIcon = '✓';
            statusBadge = (
              <span
                style={{
                  color: '#15803d',
                  background: '#dcfce7',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                🟢 Reached {stop.reached_at ? `(${new Date(stop.reached_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
              </span>
            );
          } else if (isCurrent) {
            nodeBg = '#3b82f6'; // blue current
            nodeBorder = '#1d4ed8';
            nodeIcon = '🚌';
            statusBadge = (
              <span
                style={{
                  color: '#1d4ed8',
                  background: '#dbeafe',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  border: '1px solid #bfdbfe',
                }}
              >
                🚌 Bus En Route
              </span>
            );
          }

          return (
            <div
              key={stop.id}
              style={{
                display: 'flex',
                gap: 16,
                position: 'relative',
                minHeight: isLast ? 48 : 72,
              }}
            >
              {/* Timeline Connector Line */}
              {!isLast && (
                <div
                  style={{
                    position: 'absolute',
                    left: 17,
                    top: 36,
                    bottom: 0,
                    width: 4,
                    background: isReached ? '#86efac' : '#e2e8f0',
                    borderRadius: 2,
                    zIndex: 0,
                  }}
                />
              )}

              {/* Step Circle / Badge */}
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  background: nodeBg,
                  border: `3px solid ${nodeBorder}`,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: isCurrent ? 18 : 13,
                  zIndex: 1,
                  boxShadow: isCurrent ? '0 0 0 4px rgba(59, 130, 246, 0.25)' : 'none',
                  transition: 'all 0.3s ease',
                  flexShrink: 0,
                }}
              >
                {nodeIcon}
              </div>

              {/* Stop Info Card */}
              <div
                style={{
                  flex: 1,
                  padding: '6px 14px 14px',
                  background: isCurrent ? '#f0f7ff' : 'transparent',
                  border: isCurrent ? '1px solid #bfdbfe' : 'none',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: isCurrent ? 800 : 700, color: '#1e293b' }}>
                    {stop.name}
                  </div>
                  {statusBadge}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: '#64748b',
                    display: 'flex',
                    gap: 14,
                    marginTop: 4,
                    alignItems: 'center',
                  }}
                >
                  <span>Stop #{stop.stop_order}</span>
                  {stop.scheduled_time && <span>Scheduled: {stop.scheduled_time}</span>}
                  {(() => {
                    let displayDistance = null;
                    if (
                      stop.distanceToBus !== null &&
                      stop.distanceToBus !== undefined &&
                      stop.distanceToBus < 2000000
                    ) {
                      displayDistance = stop.distanceToBus;
                    } else if (hasValidGps && isValidGeoCoord(stop.latitude, stop.longitude)) {
                      displayDistance = calculateHaversineMeters(
                        location.latitude,
                        location.longitude,
                        stop.latitude,
                        stop.longitude
                      );
                    }

                    if (displayDistance !== null) {
                      return (
                        <span
                          style={{
                            fontWeight: 600,
                            color: displayDistance <= 100 ? '#16a34a' : '#64748b',
                          }}
                        >
                          Distance: {displayDistance < 1000 ? `${displayDistance}m` : `${(displayDistance / 1000).toFixed(1)}km`}
                        </span>
                      );
                    }

                    return (
                      <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>
                        Waiting for live GPS signal
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
