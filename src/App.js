import './index.css';
import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import UserProfileModalHost from './components/UserProfileModalHost';
import { AuthProvider } from './contexts/AuthContext';
import { SoundCloudAuthProvider } from './contexts/SoundCloudAuthContext';
import { SpotifyAuthProvider } from './contexts/SpotifyAuthContext';
import RequirePlayerAuth from './components/auth/RequirePlayerAuth';
import { PLAYER_AUTH } from './utils/playerAuthConfig';

import Home from './pages/Home.jsx';
import Callback from './pages/Callback.jsx';
import TestPlayerPageMay20260504 from './pages/TestPlayerPage_20260504.jsx';
import TestPlayerPageMay20260518 from './pages/TestPlayerPage_20260518.jsx';
import LocalPlayerPage from './pages/LocalPlayerPage.jsx';
import SoundCloudPlayerPage from './pages/SoundCloudPlayerPage.jsx';
import SoundCloudCallbackPage from './pages/SoundCloudCallbackPage.jsx';
import SpotifyPlayerPage from './pages/SpotifyPlayerPage.jsx';
import SpotifyCallbackPage from './pages/SpotifyCallbackPage.jsx';
import SpotifyConnectPage from './pages/SpotifyConnectPage.jsx';
import PrivacyNotice from './pages/PrivacyNotice.jsx';
import TermsOfUse from './pages/TermsOfUse.jsx';
import About from './pages/About.jsx';

const App = () => {
  useEffect(() => {
  }, []);

  return (
    <AuthProvider>
      <SoundCloudAuthProvider>
        <SpotifyAuthProvider>
          <Router>
            <UserProfileModalHost />
            <Routes>
              <Route path="/" element={<><Navigation /><Home /></>} />
              <Route path="/landing" element={<Navigate to="/" replace />} />
              <Route path="/callback" element={<><Navigation /><Callback /></>} />

              <Route
                path="/testplayer/20260504"
                element={
                  <>
                    <Navigation />
                    <RequirePlayerAuth authType={PLAYER_AUTH.TUNETRIBES}>
                      <TestPlayerPageMay20260504 />
                    </RequirePlayerAuth>
                  </>
                }
              />
              <Route
                path="/testplayer/20260518"
                element={
                  <>
                    <Navigation />
                    <RequirePlayerAuth authType={PLAYER_AUTH.SPOTIFY}>
                      <TestPlayerPageMay20260518 />
                    </RequirePlayerAuth>
                  </>
                }
              />
              <Route path="/testplayer" element={<Navigate to="/testplayer/20260518" replace />} />

              <Route
                path="/localplayer"
                element={
                  <>
                    <Navigation />
                    <RequirePlayerAuth authType={PLAYER_AUTH.TUNETRIBES}>
                      <LocalPlayerPage />
                    </RequirePlayerAuth>
                  </>
                }
              />
              <Route
                path="/soundcloudplayer"
                element={
                  <>
                    <Navigation />
                    <RequirePlayerAuth authType={PLAYER_AUTH.SOUNDCLOUD}>
                      <SoundCloudPlayerPage />
                    </RequirePlayerAuth>
                  </>
                }
              />
              <Route path="/soundcloud/callback" element={<><Navigation /><SoundCloudCallbackPage /></>} />
              <Route
                path="/spotifyplayer"
                element={
                  <>
                    <Navigation />
                    <RequirePlayerAuth authType={PLAYER_AUTH.SPOTIFY}>
                      <SpotifyPlayerPage />
                    </RequirePlayerAuth>
                  </>
                }
              />
              <Route path="/spotify/connect" element={<SpotifyConnectPage />} />
              <Route path="/spotify/callback" element={<SpotifyCallbackPage />} />
              <Route path="/privacy" element={<><Navigation /><PrivacyNotice /></>} />
              <Route path="/terms" element={<><Navigation /><TermsOfUse /></>} />
              <Route path="/about" element={<><Navigation /><About /></>} />
            </Routes>
          </Router>
        </SpotifyAuthProvider>
      </SoundCloudAuthProvider>
    </AuthProvider>
  );
}

export default App;
