import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { SettingsProvider } from './context/SettingsContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Play } from './pages/Play';
import { Matchmaking } from './pages/Matchmaking';
import { LiveGame } from './pages/LiveGame';
import { LocalBotGame } from './pages/LocalBotGame';
import { Profile } from './pages/Profile';
import { Browse } from './pages/Browse';
import { PublicProfilePage } from './pages/PublicProfile';
import { Friends } from './pages/Friends';
import { Leaderboards } from './pages/Leaderboards';
import { Settings } from './pages/Settings';
import { Spectate } from './pages/Spectate';
import { Admin } from './pages/Admin';
import { NotFound } from './pages/NotFound';
import { Challenge } from './pages/Challenge';
import { GameHistory } from './pages/GameHistory';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <NotificationProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/play" element={<ProtectedRoute><Play /></ProtectedRoute>} />
                <Route path="/matchmaking/:mode" element={<ProtectedRoute><Matchmaking /></ProtectedRoute>} />
                <Route path="/game/:gameId" element={<LiveGame />} />
                <Route path="/bot-game/:gameId" element={<ProtectedRoute><LocalBotGame /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/browse" element={<ProtectedRoute><Browse /></ProtectedRoute>} />
                <Route path="/player/:uid" element={<PublicProfilePage />} />
                <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
                <Route path="/leaderboards" element={<Leaderboards />} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/spectate" element={<Spectate />} />
                <Route path="/game-history" element={<ProtectedRoute><GameHistory /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/challenge/:code" element={<Challenge />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </NotificationProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
