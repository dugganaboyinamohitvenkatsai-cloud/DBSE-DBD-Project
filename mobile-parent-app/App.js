import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  Shield,
  Route,
  Bell,
  User,
  Radio,
} from 'lucide-react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ParentDashboardProvider, useParentDashboard } from './src/context/ParentDashboardContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import LiveTrackingScreen from './src/screens/LiveTrackingScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ChildDetailsScreen from './src/screens/ChildDetailsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { setupNotificationChannels } from './src/services/notificationService';
import { COLORS, RADIUS, SHADOWS, SPACING } from './src/constants/theme';

const TABS = [
  { key: 'home', label: 'Safety', Icon: Shield },
  { key: 'tracking', label: 'Tracking', Icon: Route },
  { key: 'notifications', label: 'Alerts', Icon: Bell },
  { key: 'profile', label: 'Profile', Icon: User },
];

function ParentMainShell() {
  const { user } = useAuth();
  const {
    activeStudentStatus,
    unreadCount,
  } = useParentDashboard();

  const [currentTab, setCurrentTab] = useState('home');
  const [subScreen, setSubScreen] = useState(null); // 'child_details' | null

  const isTripLive = activeStudentStatus?.trip?.status === 'IN_PROGRESS';

  return (
    <SafeAreaView style={styles.shellContainer} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />

      {/* Top Application Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandGroup}>
          <View style={styles.brandIconWrap}>
            <Shield size={18} color="#FFFFFF" strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.topBarTitle}>SCHOOLBUS PARENT</Text>
            <Text style={styles.topBarSub} numberOfLines={1}>
              {user?.name || user?.full_name || 'Parent Guardian'} • Safety v1.0
            </Text>
          </View>
        </View>

        <View style={[styles.statusPill, isTripLive ? styles.statusPillLive : styles.statusPillIdle]}>
          <View style={[styles.statusPillDot, isTripLive ? styles.dotLive : styles.dotIdle]} />
          <Text style={[styles.statusPillText, isTripLive ? styles.textLive : styles.textIdle]}>
            {isTripLive ? 'LIVE TRANSIT' : 'PROTECTED'}
          </Text>
        </View>
      </View>

      {/* Main Screen Canvas */}
      <View style={styles.contentCanvas}>
        {subScreen === 'child_details' ? (
          <ChildDetailsScreen onBack={() => setSubScreen(null)} />
        ) : (
          <>
            {currentTab === 'home' && (
              <HomeScreen
                onNavigateTab={(tab) => {
                  setSubScreen(null);
                  setCurrentTab(tab);
                }}
                onOpenChildDetails={() => setSubScreen('child_details')}
              />
            )}
            {currentTab === 'tracking' && <LiveTrackingScreen />}
            {currentTab === 'notifications' && <NotificationsScreen />}
            {currentTab === 'profile' && <ProfileScreen />}
          </>
        )}
      </View>

      {/* Bottom Navigation Bar (hidden when modal subscreen is open) */}
      {!subScreen && (
        <SafeAreaView edges={['bottom']} style={styles.bottomNavSafeArea}>
          <View style={styles.bottomNav}>
            {TABS.map((tab) => {
              const isActive = currentTab === tab.key;
              const TabIcon = tab.Icon;
              const isAlertsTab = tab.key === 'notifications';

              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.navItem, isActive ? styles.navItemActive : null]}
                  onPress={() => {
                    setSubScreen(null);
                    setCurrentTab(tab.key);
                  }}
                  activeOpacity={0.7}
                  accessibilityLabel={tab.label}
                >
                  <View style={styles.navIconContainer}>
                    <TabIcon
                      size={20}
                      color={isActive ? COLORS.blue : COLORS.textSecondary}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {isAlertsTab && unreadCount > 0 && (
                      <View style={styles.badgeWrap}>
                        <Text style={styles.badgeText}>
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.navLabel, isActive ? styles.navLabelActive : null]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

function NavigationRoot() {
  const { isAuthenticated, isLoading } = useAuth();

  // Initialize Android Notification Channels
  useEffect(() => {
    setupNotificationChannels().catch((err) => {
      console.warn('[App] Notification channel setup warning:', err);
    });
  }, []);

  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0B132B" />
        <View style={styles.splashIconBox}>
          <Shield size={36} color="#FFFFFF" strokeWidth={2.4} />
        </View>
        <Text style={styles.splashTitle}>SCHOOLBUS PARENT</Text>
        <Text style={styles.splashSubtitle}>Connecting to Child Transit Portal...</Text>
        <ActivityIndicator size="small" color={COLORS.blue} style={styles.splashSpinner} />
      </View>
    );
  }

  return isAuthenticated ? (
    <ParentDashboardProvider>
      <ParentMainShell />
    </ParentDashboardProvider>
  ) : (
    <SafeAreaView style={styles.shellContainer} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <LoginScreen />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationRoot />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shellContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashIconBox: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  splashTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  splashSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  splashSpinner: {
    marginTop: SPACING.xl,
  },
  topBar: {
    height: 56,
    backgroundColor: '#0B132B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  brandIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  topBarSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  statusPillLive: {
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    borderColor: 'rgba(22, 163, 74, 0.4)',
  },
  statusPillIdle: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotLive: {
    backgroundColor: '#22C55E',
  },
  dotIdle: {
    backgroundColor: '#94A3B8',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textLive: {
    color: '#4ADE80',
  },
  textIdle: {
    color: '#94A3B8',
  },
  contentCanvas: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bottomNavSafeArea: {
    backgroundColor: '#0B132B',
  },
  bottomNav: {
    height: 60,
    backgroundColor: '#0B132B',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navItemActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  navIconContainer: {
    position: 'relative',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  navLabelActive: {
    color: COLORS.blue,
    fontWeight: '700',
  },
  badgeWrap: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: COLORS.danger,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
