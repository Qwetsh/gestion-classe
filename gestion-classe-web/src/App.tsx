import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LiveSessionProvider } from './contexts/LiveSessionContext';
import { GroupSessionProvider } from './contexts/GroupSessionContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UIFeedbackProvider } from './contexts/UIFeedbackContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { Login } from './pages/Login';
// Les autres pages sont chargées à la demande (voir lazyPages.ts)
import {
  Dashboard,
  Analytics,
  Classes,
  Sessions,
  SessionDetail,
  Journal,
  GroupSessions,
  TpTemplates,
  DevPanel,
  ToolGrid,
  ToolView,
  Students,
  Rewards,
  StudentDashboard,
  StudentBinder,
  MobileDocument,
  Classroom,
  Pronote,
  Academy,
  Brevets,
  Clouds,
  Courses,
  Binder,
  Evaluations,
  AssessmentSheet,
  Productions,
  LiveActivity,
  CopyDepot,
} from './lazyPages';
import { PageLoading } from './components/PageLoading';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LiveSessionOverlay } from './components/live-session/LiveSessionOverlay';
import { GroupSessionOverlay } from './components/live-session/GroupSessionOverlay';

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
    <UIFeedbackProvider>
    <SettingsProvider>
    <LiveSessionProvider>
    <GroupSessionProvider>
    <BrowserRouter basename="/gestion-classe">
      <LiveSessionOverlay />
      <GroupSessionOverlay />
      <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/eleve" element={<StudentDashboard />} />
        {/* Classeur de la classe, par le lien de Pronote (jeton dans le chemin) */}
        <Route path="/classeur/c/:token" element={<StudentBinder />} />
        {/* Version couleur d'un document imprimé, par son QR code (jeton dans le chemin) */}
        <Route path="/d/:token" element={<MobileDocument />} />
        {/* Envoi d'une copie depuis le téléphone (QR code de « Ajouter une copie », jeton dans le #) */}
        <Route path="/depot" element={<CopyDepot />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Mes cours : bibliothèque des cours préparés ; ?ouvrir=<id> ouvre un cours (PLAN_mes_cours.md) */}
        <Route
          path="/cours"
          element={
            <ProtectedRoute>
              <Courses />
            </ProtectedRoute>
          }
        />
        {/* Classeur virtuel : le classeur d'un élève assemblé depuis la bibliothèque (PLAN_classeur_virtuel.md) */}
        <Route
          path="/classeur"
          element={
            <ProtectedRoute>
              <Binder />
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
        {/* Mode « en classe » : vue projetée plein écran, sans layout */}
        <Route
          path="/classe"
          element={
            <ProtectedRoute>
              <Classroom />
            </ProtectedRoute>
          }
        />
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
          path="/cahier-de-texte"
          element={
            <ProtectedRoute>
              <Journal />
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
          path="/brevets"
          element={
            <ProtectedRoute>
              <Brevets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clouds"
          element={
            <ProtectedRoute>
              <Clouds />
            </ProtectedRoute>
          }
        />
        <Route
          path="/evaluations"
          element={
            <ProtectedRoute>
              <Evaluations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/evaluations/:id"
          element={
            <ProtectedRoute>
              <AssessmentSheet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/direct"
          element={
            <ProtectedRoute>
              <LiveActivity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/productions"
          element={
            <ProtectedRoute>
              <Productions />
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
          path="/academy"
          element={
            <ProtectedRoute>
              <Academy />
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
          path="/pronote"
          element={
            <ProtectedRoute>
              <Pronote />
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
      </Suspense>
    </BrowserRouter>
    </GroupSessionProvider>
    </LiveSessionProvider>
    </SettingsProvider>
    </UIFeedbackProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
