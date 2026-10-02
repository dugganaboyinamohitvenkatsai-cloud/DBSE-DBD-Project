import React, { useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Gauge,
  Users,
  Route,
  Activity,
  User,
  Radio,
  Bus,
} from 'lucide-react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { TrackingProvider } from './src/context/TrackingContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { ActiveCockpitScreen } from './src/screens/ActiveCockpitScreen';
import { StudentRosterScreen } from './src/screens/StudentRosterScreen';
import { TripsListScreen } from './src/screens/TripsListScreen';
import { DiagnosticsScreen } from './src/screens/DiagnosticsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { COLORS, RADIUS, SHADOWS } from './src/constants/theme';

const TABS = [
  { key: 'cockpit', label: 'Cockpit', Icon: Gauge },
  { key: 'students', label: 'Students', Icon: Users },
  { key: 'runs', label: 'Runs', Icon: Route },
  { key: 'health', label: 'Health', Icon: Activity },
  { key: 'profile', label: 'Profile', Icon: User },
];

function DriverMainShell() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('cockpit');

  return (
    <SafeAreaView style={styles.shellContainer} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />

      {/* Top Application Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandGroup}>
          <View style={styles.brandIconWrap}>
            <Bus size={18} color="#FFFFFF" strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.topBarTitle}>SCHOOLBUS DRIVER</Text>
            <Text style={styles.topBarDriver} numberOfLines={1}>
              {user?.full_name || 'Driver Operator'} • Cockpit v1.0
            </Text>
          </View>
        </View>

        <View style={styles.activePill}>
          <View style={styles.onlineDot} />
          <Text style={styles.activePillText}>CONNECTED</Text>
        </View>
      </View>

      {/* Main Screen Canvas */}
      <View style={styles.contentCanvas}>
        {currentTab === 'cockpit' && (
          <ActiveCockpitScreen onNavigateToRoster={() => setCurrentTab('students')} />
        )}
        {currentTab === 'students' && <StudentRosterScreen />}
        {currentTab === 'runs' && (
          <TripsListScreen onSelectTrip={() => setCurrentTab('cockpit')} />
        )}
        {currentTab === 'health' && <DiagnosticsScreen />}
        {currentTab === 'profile' && <ProfileScreen />}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        {TABS.map((tab) => {
          const isActive = currentTab === tab.key;
          const TabIcon = tab.Icon;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.navItem, isActive ? styles.navItemActive : null]}
              onPress={() => setCurrentTab(tab.key)}
              activeOpacity={0.7}
            >
              <TabIcon
                size={20}
                color={isActive ? COLORS.blue : COLORS.textSecondary}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <Text style={[styles.navLabel, isActive ? styles.navLabelActive : null]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function NavigationRoot() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0B132B" />
        <View style={styles.loadingIconWrap}>
          <Bus size={36} color="#38BDF8" strokeWidth={2.2} />
        </View>
        <ActivityIndicator size="large" color="#38BDF8" style={{ marginTop: 16 }} />
        <Text style={styles.loadingText}>Initializing Driver Cockpit...</Text>
        <Text style={styles.loadingSub}>Connecting to School Transportation Server</Text>
      </View>
    );
  }

  return isAuthenticated ? <DriverMainShell /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <TrackingProvider>
          <NavigationRoot />
        </TrackingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shellContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0B132B',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  brandIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  topBarDriver: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#334155',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  activePillText: {
    color: '#86EFAC',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  contentCanvas: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 6,
    minHeight: 58,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  navItemActive: {
    backgroundColor: COLORS.blueLight,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  navLabelActive: {
    color: COLORS.blue,
    fontWeight: '900',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 16,
    letterSpacing: 0.3,
  },
  loadingSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
});
