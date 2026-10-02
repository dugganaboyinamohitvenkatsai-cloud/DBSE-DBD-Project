import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Radio,
  Database,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
} from 'lucide-react-native';
import { useTracking } from '../context/TrackingContext';
import { API_BASE_URL } from '../api/client';
import { flushTelemetryQueue, getQueueLength } from '../services/telemetryQueue';
import { TouchButton } from '../components/TouchButton';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

export function DiagnosticsScreen() {
  const { currentLocation, trackingState, lastUploadedAt } = useTracking();
  const [queueCount, setQueueCount] = useState(getQueueLength());
  const [syncing, setSyncing] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  async function handleFlush() {
    setSyncing(true);
    try {
      const { flushed, remaining } = await flushTelemetryQueue();
      setQueueCount(remaining);
      Alert.alert(
        'Queue Flushed',
        `Successfully transmitted ${flushed} buffered telemetry packet(s) to server.`
      );
    } catch (err) {
      Alert.alert('Sync Error', err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handlePing() {
    setPingResult({ status: 'pinging', text: 'Measuring server round-trip latency...' });
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const roundTrip = Date.now() - start;
      if (res.ok) {
        setPingResult({
          status: 'ok',
          text: `Online • HTTP 200 OK (${roundTrip}ms)`,
        });
      } else {
        setPingResult({
          status: 'warn',
          text: `Server responded with HTTP ${res.status} (${roundTrip}ms)`,
        });
      }
    } catch (err) {
      setPingResult({
        status: 'error',
        text: `Unreachable: ${err.message}`,
      });
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>TELEMETRY & HARDWARE HEALTH</Text>
          <Text style={styles.subtitle}>Real-time sensor diagnostics & offline buffers</Text>
        </View>

        {/* GPS Hardware Telemetry Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Radio size={16} color={COLORS.blue} strokeWidth={2.5} />
            <Text style={styles.cardTitle}>Device GPS Sensor Diagnostics</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Tracking State</Text>
            <View style={styles.statePill}>
              <Text style={styles.statePillText}>{trackingState}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Current Latitude</Text>
            <Text style={styles.value}>
              {currentLocation?.latitude ? Number(currentLocation.latitude).toFixed(6) : '—'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Current Longitude</Text>
            <Text style={styles.value}>
              {currentLocation?.longitude ? Number(currentLocation.longitude).toFixed(6) : '—'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Horizontal Accuracy</Text>
            <Text style={styles.value}>
              {currentLocation?.accuracy ? `±${Math.round(currentLocation.accuracy)} meters` : '—'}
            </Text>
          </View>
          <View style={[styles.row, styles.noBorder]}>
            <Text style={styles.label}>Last Transmitted</Text>
            <Text style={styles.value}>
              {lastUploadedAt ? lastUploadedAt.toLocaleTimeString() : 'Standby'}
            </Text>
          </View>
        </View>

        {/* Offline Queue Buffer Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Database size={16} color={COLORS.warning} strokeWidth={2.5} />
            <Text style={styles.cardTitle}>Offline Telemetry Buffer</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Queued In-Memory Points</Text>
            <Text
              style={[
                styles.value,
                { color: queueCount > 0 ? COLORS.warning : COLORS.successText },
              ]}
            >
              {queueCount} {queueCount === 1 ? 'packet' : 'packets'}
            </Text>
          </View>
          <Text style={styles.queueHint}>
            Coordinates acquired during network drops are securely cached locally and automatically flushed to the MySQL database upon reconnect.
          </Text>

          <TouchButton
            title={syncing ? 'DRAINING QUEUE...' : 'FLUSH BUFFER TO SERVER'}
            icon={<Send size={15} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={handleFlush}
            disabled={queueCount === 0 || syncing}
            variant="secondary"
            style={{ marginTop: 12, minHeight: 48 }}
          />
        </View>

        {/* Server Endpoint Connectivity Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Server size={16} color={COLORS.primary} strokeWidth={2.5} />
            <Text style={styles.cardTitle}>Backend Endpoint Health</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Configured API Base</Text>
            <Text style={[styles.value, { fontSize: 11, fontFamily: 'monospace' }]}>
              {API_BASE_URL}
            </Text>
          </View>

          {pingResult ? (
            <View
              style={[
                styles.pingBox,
                pingResult.status === 'ok'
                  ? styles.pingOk
                  : pingResult.status === 'error'
                  ? styles.pingError
                  : styles.pingWarn,
              ]}
            >
              {pingResult.status === 'ok' ? (
                <CheckCircle2 size={14} color={COLORS.successText} />
              ) : pingResult.status === 'error' ? (
                <AlertTriangle size={14} color={COLORS.dangerText} />
              ) : (
                <Activity size={14} color={COLORS.warningText} />
              )}
              <Text
                style={[
                  styles.pingText,
                  pingResult.status === 'ok'
                    ? styles.textOk
                    : pingResult.status === 'error'
                    ? styles.textError
                    : styles.textWarn,
                ]}
              >
                {pingResult.text}
              </Text>
            </View>
          ) : null}

          <TouchButton
            title="TEST LIVE API CONNECTIVITY"
            icon={<Activity size={15} color="#FFFFFF" strokeWidth={2.2} />}
            onPress={handlePing}
            variant="primary"
            style={{ marginTop: 12, minHeight: 48 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.6,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 14,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  value: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '800',
  },
  statePill: {
    backgroundColor: COLORS.surfaceHighlight,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
  },
  statePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.blue,
  },
  queueHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginTop: 8,
  },
  pingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  pingOk: {
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.successBorder,
  },
  pingError: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.dangerBorder,
  },
  pingWarn: {
    backgroundColor: COLORS.warningLight,
    borderColor: COLORS.warningBorder,
  },
  pingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textOk: {
    color: COLORS.successText,
  },
  textError: {
    color: COLORS.dangerText,
  },
  textWarn: {
    color: COLORS.warningText,
  },
});
