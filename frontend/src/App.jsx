import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { ModulePlaceholder } from './pages/ModulePlaceholder.jsx';
import { StudentsPage } from './pages/admin/StudentsPage.jsx';
import { ParentsPage } from './pages/admin/ParentsPage.jsx';
import { DriversPage } from './pages/admin/DriversPage.jsx';
import { BusesPage } from './pages/admin/BusesPage.jsx';
import { RoutesPage } from './pages/admin/RoutesPage.jsx';
import { TripsPage } from './pages/admin/TripsPage.jsx';
import { SeatAssignmentsPage } from './pages/admin/SeatAssignmentsPage.jsx';
import { DriverLocationPage } from './pages/driver/DriverLocationPage.jsx';
import { DriverTripsPage } from './pages/driver/DriverTripsPage.jsx';
import { DriverStudentsPage } from './pages/driver/DriverStudentsPage.jsx';
import { ParentDashboardPage } from './pages/parent/ParentDashboardPage.jsx';
import { ParentNotificationsPage } from './pages/parent/ParentNotificationsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute roles={['ADMIN', 'PARENT', 'DRIVER']} />}>
        <Route element={<AppLayout />}>
          {/* Admin-specific routes */}
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/students" element={<StudentsPage />} />
          <Route path="/admin/parents" element={<ParentsPage />} />
          <Route path="/admin/drivers" element={<DriversPage />} />
          <Route path="/admin/buses" element={<BusesPage />} />
          <Route path="/admin/routes" element={<RoutesPage />} />
          <Route path="/admin/trips" element={<TripsPage />} />
          <Route path="/admin/seats" element={<SeatAssignmentsPage />} />

          {/* Driver-specific routes */}
          <Route path="/driver" element={<DashboardPage />} />
          <Route path="/driver/trips" element={<DriverTripsPage />} />
          <Route path="/driver/students" element={<DriverStudentsPage />} />
          <Route path="/driver/location" element={<DriverLocationPage />} />

          {/* Parent-specific routes */}
          <Route path="/parent" element={<ParentDashboardPage />} />
          <Route path="/parent/dashboard" element={<ParentDashboardPage />} />
          <Route path="/parent/tracking" element={<ParentDashboardPage />} />
          <Route path="/parent/students" element={<ParentDashboardPage />} />
          <Route path="/parent/notifications" element={<ParentNotificationsPage />} />

          {/* Generic role and module fallbacks */}
          <Route path="/:role" element={<DashboardPage />} />
          <Route path="/:role/:module" element={<ModulePlaceholder />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

