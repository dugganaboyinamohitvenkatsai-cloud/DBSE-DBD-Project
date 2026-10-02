import { submitDriverLocation } from '../api/tripApi';

let memoryQueue = [];
let isFlushing = false;

export function getQueueLength() {
  return memoryQueue.length;
}

export function queueLocationPoint(point) {
  memoryQueue.push({
    ...point,
    queued_at: new Date().toISOString(),
  });
  // Cap at 200 points to prevent memory overflow
  if (memoryQueue.length > 200) {
    memoryQueue.shift();
  }
}

export async function flushTelemetryQueue() {
  if (isFlushing || memoryQueue.length === 0) return { flushed: 0, remaining: memoryQueue.length };

  isFlushing = true;
  let flushedCount = 0;

  try {
    while (memoryQueue.length > 0) {
      const nextPoint = memoryQueue[0];
      try {
        await submitDriverLocation({
          latitude: nextPoint.latitude,
          longitude: nextPoint.longitude,
          accuracy: nextPoint.accuracy,
          timestamp: nextPoint.timestamp,
          trip_id: nextPoint.trip_id,
        });
        memoryQueue.shift();
        flushedCount++;
      } catch (err) {
        // If upload fails, stop draining and retain remaining points
        console.warn('[TelemetryQueue] Flush stopped due to upload error:', err.message);
        break;
      }
    }
  } finally {
    isFlushing = false;
  }

  return { flushed: flushedCount, remaining: memoryQueue.length };
}

export function clearTelemetryQueue() {
  memoryQueue = [];
}
