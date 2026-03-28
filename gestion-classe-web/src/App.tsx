import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LiveSessionProvider } from './contexts/LiveSessionContext';
import { GroupSessionProvider } from './contexts/GroupSessionContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { Classes } from './pages/Classes';
import { Sessions } from './pages/Sessions';
import { SessionDetail } from './pages/SessionDetail';
import { GroupSessions } from './pages/GroupSessions';
import { TpTemplates } from './pages/TpTemplates';
import { DevPanel } from './pages/DevPanel';
import { ToolGrid, ToolView } from './pages/Toolbox';
import { Students } from './pages/Students';
import { Rewards } from './pages/Rewards';
import { StudentDashboard } from './pages/StudentDashboard';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LiveSessionOverlay } from './components/live-session/LiveSessionOverlay';
import { GroupSessionOverlay } from './components/live-session/GroupSessionOverlay';

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
    <LiveSessionProvider>
    <GroupSessionProvider>
    <BrowserRouter basename="/gestion-classe">
      <LiveSessionOverlay />
      <GroupSessionOverlay />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/eleve" element={<StudentDashboard />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/classes"
          element={
            <ProtectedRoute>
              <Classes />
            </ProtectedRoute>
          }
        />
        <Route path="/rooms" element={<Navigate to="/classes" replace />} />
        <Route
          path="/sessions"
          element={
            <ProtectedRoute>
              <Sessions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sessions/:id"
          element={
            <ProtectedRoute>
              <SessionDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/group-sessions"
          element={
            <ProtectedRoute>
              <GroupSessions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tp-templates"
          element={
            <ProtectedRoute>
              <TpTemplates />
            </ProtectedRoute>
          }
        />
        <Route
          path="/students"
          element={
            <ProtectedRoute>
              <Students />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rewards"
          element={
            <ProtectedRoute>
              <Rewards />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools"
          element={
            <ProtectedRoute>
              <ToolGrid />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools/:toolId"
          element={
            <ProtectedRoute>
              <ToolView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dev"
          element={
            <ProtectedRoute>
              <DevPanel />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </GroupSessionProvider>
    </LiveSessionProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
