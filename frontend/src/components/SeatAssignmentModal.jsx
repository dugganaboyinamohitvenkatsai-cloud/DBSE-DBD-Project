import React from 'react';
import { X, Armchair } from 'lucide-react';
import { BusSeatMap } from './BusSeatMap';

export function SeatAssignmentModal({ tripId, onClose, onUpdated }) {
  if (!tripId) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card panel"
        style={{
          width: 'min(100%, 860px)',
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '24px',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seat-modal-title"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: 14,
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Armchair size={20} />
            </div>
            <div>
              <h2
                id="seat-modal-title"
                style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}
              >
                Bus Seat Allocations
              </h2>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Trip #{tripId} • Real-time Passenger Allocation Grid
              </span>
            </div>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <BusSeatMap tripId={tripId} onUpdated={onUpdated} />
      </div>
    </div>
  );
}
