import './index.css';
import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import UserProfileModalHost from './components/UserProfileModalHost';
import { AuthProvider } from './contexts/AuthContext';
import { TutorialProvider } from './contexts/TutorialContext';
import { SoundCloudAuthProvider } from './contexts/SoundCloudAuthContext';
import { SpotifyAuthProvider } from './contexts/SpotifyAuthContext';
import RequireAuth from './components/auth/RequireAuth';

import Home from './pages/Home.jsx';
import Callback from './pages/Callback.jsx';
import TestPlayerPage from './pages/TestPlayerPage.jsx';
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
        <TutorialProvider>
          <Router>
            <UserProfileModalHost />
            <Routes>
              <Route path="/" element={<><Navigation /><Home /></>} />
              <Route path="/landing" element={<Navigate to="/" replace />} />
              <Route path="/callback" element={<><Navigation /><Callback /></>} />

              <Route path="/testplayer" element={<><Navigation /><RequireAuth><TestPlayerPage /></RequireAuth></>} />
              <Route path="/localplayer" element={<><Navigation /><RequireAuth><LocalPlayerPage /></RequireAuth></>} />
              <Route path="/soundcloudplayer" element={<><Navigation /><RequireAuth><SoundCloudPlayerPage /></RequireAuth></>} />
              <Route path="/soundcloud/callback" element={<><Navigation /><SoundCloudCallbackPage /></>} />
              <Route path="/spotifyplayer" element={<><Navigation /><RequireAuth><SpotifyPlayerPage /></RequireAuth></>} />
              <Route path="/spotify/connect" element={<SpotifyConnectPage />} />
              <Route path="/spotify/callback" element={<SpotifyCallbackPage />} />
              <Route path="/privacy" element={<><Navigation /><PrivacyNotice /></>} />
              <Route path="/terms" element={<><Navigation /><TermsOfUse /></>} />
              <Route path="/about" element={<><Navigation /><About /></>} />
            </Routes>
          </Router>
        </TutorialProvider>
        </SpotifyAuthProvider>
      </SoundCloudAuthProvider>
    </AuthProvider>
  );
}

export default App;
