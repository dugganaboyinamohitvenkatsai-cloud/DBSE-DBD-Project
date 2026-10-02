import React, { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { BusSeatMap } from '../../components/BusSeatMap';
import {
  Armchair,
  Bus,
  Calendar,
  Route as RouteIcon,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

export function SeatAssignmentsPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedTripId, setSelectedTripId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/admin/trips');
      const items = res.trips || res.items || [];
      setTrips(items);
      if (items.length > 0 && !selectedTripId) {
        // Default to first active or scheduled trip, or first trip
        const defaultTrip =
          items.find((t) => t.status === 'IN_PROGRESS' || t.status === 'STARTED' || t.status === 'SCHEDULED') ||
          items[0];
        if (defaultTrip) {
          setSelectedTripId(String(defaultTrip.id));
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load trips for seat assignment.');
    } finally {
      setLoading(false);
    }
  }, [selectedTripId]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const filteredTrips = trips.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(t.id).includes(q) ||
      t.bus_number?.toLowerCase().includes(q) ||
      t.registration_number?.toLowerCase().includes(q) ||
      t.route_name?.toLowerCase().includes(q) ||
      t.driver_name?.toLowerCase().includes(q) ||
      t.trip_date?.includes(q)
    );
  });

  const selectedTrip = trips.find((t) => String(t.id) === String(selectedTripId));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Page Header ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <span className="eyebrow">Fleet Management</span>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--sb-primary-950, #0f172a)', margin: '4px 0 0' }}>
            Bus Seat Allocations
          </h1>
          <p style={{ color: '#64748b', fontSize: 13.5, margin: '4px 0 0' }}>
            Assign students to designated seats with strict 1:1 conflict prevention and live roster synchronization.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert-box alert-box--danger">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Trip Selector Toolbar ── */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 14,
          padding: '16px 20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 220, flex: 1 }}>
          <label className="field-label" htmlFor="trip-select" style={{ margin: 0, whiteSpace: 'nowrap' }}>
            Select Trip:
          </label>
          <select
            id="trip-select"
            className="text-input"
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            disabled={loading}
            style={{ fontWeight: 600, fontSize: 13 }}
          >
            {loading && <option value="">Loading trips…</option>}
            {!loading && trips.length === 0 && <option value="">No trips available</option>}
            {filteredTrips.map((t) => (
              <option key={t.id} value={t.id}>
                Trip #{t.id} • Bus {t.bus_number} ({t.route_name}) • {t.trip_date} [{t.status}]
              </option>
            ))}
          </select>
        </div>

        {/* Quick Filter */}
        <div style={{ position: 'relative', width: 260 }}>
          <input
            className="text-input"
            type="text"
            placeholder="Filter trips by bus/route..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 30, fontSize: 12.5 }}
          />
          <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        </div>
      </div>

      {/* ── Main Seat Map ── */}
      {selectedTripId ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
          }}
        >
          <BusSeatMap tripId={selectedTripId} onUpdated={fetchTrips} />
        </div>
      ) : (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: 14,
            border: '1px dashed #cbd5e1',
          }}
        >
          <Armchair size={40} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#334155', margin: 0 }}>
            No Trip Selected
          </h3>
          <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>
            Choose a trip from the dropdown above to view and manage its seat assignments.
          </p>
        </div>
      )}
    </div>
  );
}
export default SeatAssignmentsPage;
