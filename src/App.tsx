import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { SettingsProvider } from './context/SettingsContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Spinner } from './components/ui/Spinner';

const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Play = lazy(() => import('./pages/Play').then(m => ({ default: m.Play })));
const Matchmaking = lazy(() => import('./pages/Matchmaking').then(m => ({ default: m.Matchmaking })));
const LiveGame = lazy(() => import('./pages/LiveGame').then(m => ({ default: m.LiveGame })));
const LocalBotGame = lazy(() => import('./pages/LocalBotGame').then(m => ({ default: m.LocalBotGame })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Browse = lazy(() => import('./pages/Browse').then(m => ({ default: m.Browse })));
const PublicProfilePage = lazy(() => import('./pages/PublicProfile').then(m => ({ default: m.PublicProfilePage })));
const Friends = lazy(() => import('./pages/Friends').then(m => ({ default: m.Friends })));
const Leaderboards = lazy(() => import('./pages/Leaderboards').then(m => ({ default: m.Leaderboards })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Spectate = lazy(() => import('./pages/Spectate').then(m => ({ default: m.Spectate })));
const Admin = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const Challenge = lazy(() => import('./pages/Challenge').then(m => ({ default: m.Challenge })));
const GameHistory = lazy(() => import('./pages/GameHistory').then(m => ({ default: m.GameHistory })));
const Analysis = lazy(() => import('./pages/Analysis').then(m => ({ default: m.Analysis })));
const GameReview = lazy(() => import('./pages/GameReview').then(m => ({ default: m.GameReview })));

function LazyFallback() {
  return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}><Spinner size={40} /></div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <NotificationProvider>
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/play" element={<ProtectedRoute><Play /></ProtectedRoute>} />
                  <Route path="/matchmaking/:mode" element={<ProtectedRoute><Matchmaking /></ProtectedRoute>} />
                  <Route path="/game/:gameId" element={<LiveGame />} />
                  <Route path="/bot-game" element={<ProtectedRoute><LocalBotGame /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/browse" element={<ProtectedRoute><Browse /></ProtectedRoute>} />
                  <Route path="/player/:uid" element={<PublicProfilePage />} />
                  <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
                  <Route path="/leaderboards" element={<Leaderboards />} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/spectate" element={<Spectate />} />
                  <Route path="/game-history" element={<ProtectedRoute><GameHistory /></ProtectedRoute>} />
          <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
          <Route path="/game-review" element={<ProtectedRoute><GameReview /></ProtectedRoute>} />
          <Route path="/game-review/:gameId" element={<ProtectedRoute><GameReview /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                  <Route path="/challenge/:code" element={<Challenge />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </NotificationProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
