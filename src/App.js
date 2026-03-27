import './index.css';
import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import { AuthProvider } from './contexts/AuthContext';
import { TutorialProvider } from './contexts/TutorialContext';
import { SoundCloudAuthProvider } from './contexts/SoundCloudAuthContext';

import Home from './pages/Home.jsx';
import Landing from './pages/Landing.jsx';
import Callback from './pages/Callback.jsx';
import DemoPlayerPage from './pages/DemoPlayerPage.jsx';
import LocalPlayerPage from './pages/LocalPlayerPage.jsx';
import SoundCloudPlayerPage from './pages/SoundCloudPlayerPage.jsx';
import SoundCloudCallbackPage from './pages/SoundCloudCallbackPage.jsx';
import PrivacyNotice from './pages/PrivacyNotice.jsx';
import TermsOfUse from './pages/TermsOfUse.jsx';
import About from './pages/About.jsx';

const App = () => {
  useEffect(() => {
  }, []);

  return (
    <AuthProvider>
      <SoundCloudAuthProvider>
        <TutorialProvider>
          <Router>
            <Routes>
              <Route path="/" element={<><Navigation /><Home /></>} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/callback" element={<><Navigation /><Callback /></>} />

              <Route path="/demoplayer" element={<><Navigation /><DemoPlayerPage /></>} />
              <Route path="/localplayer" element={<><Navigation /><LocalPlayerPage /></>} />
              <Route path="/soundcloudplayer" element={<><Navigation /><SoundCloudPlayerPage /></>} />
              <Route path="/soundcloud/callback" element={<><Navigation /><SoundCloudCallbackPage /></>} />
              <Route path="/privacy" element={<><Navigation /><PrivacyNotice /></>} />
              <Route path="/terms" element={<><Navigation /><TermsOfUse /></>} />
              <Route path="/about" element={<><Navigation /><About /></>} />
            </Routes>
          </Router>
        </TutorialProvider>
      </SoundCloudAuthProvider>
    </AuthProvider>
  );
}

export default App;
