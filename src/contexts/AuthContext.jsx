import React, { useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import { AUTH_ERRORS, getErrorMessage } from '../hooks/errorHandling';

const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000; // 5 minutes in milliseconds

export const AuthContext = React.createContext(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export function AuthProvider({ children }) {
  const [idToken, setIdToken] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [refreshTimer, setRefreshTimer] = useState(null);
  const [error, setError] = useState(null);

  const clearError = () => setError(null);

  const handleAuthError = (error, errorType = AUTH_ERRORS.UNKNOWN_ERROR) => {
    console.error('Auth error:', error);
    setError(getErrorMessage(errorType));
    
    if (errorType === AUTH_ERRORS.TOKEN_EXPIRED || 
        errorType === AUTH_ERRORS.INVALID_TOKEN) {
      handleLogout();
    }
  };

  const isTokenExpired = (token) => {
    if (!token) return true;
    try {
      const { exp } = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      return currentTime >= exp;
    } catch (error) {
      handleAuthError(error, AUTH_ERRORS.INVALID_TOKEN);
      return true;
    }
  };

  const validateToken = (token) => {
    try {
      if (!token) throw new Error('No token provided');
      const decoded = jwtDecode(token);
      
      // Check required claims
      if (!decoded.sub || !decoded.exp) {
        throw new Error('Invalid token structure');
      }
      
      return !isTokenExpired(token);
    } catch (error) {
      handleAuthError(error, AUTH_ERRORS.INVALID_TOKEN);
      return false;
    }
  };

  const refreshTokens = async () => {
    try {
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      }).catch(error => {
        throw new Error('Network error during token refresh');
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const { idToken: newIdToken, accessToken: newAccessToken } = await response.json();
      
      if (!validateToken(newIdToken) || !validateToken(newAccessToken)) {
        throw new Error('Invalid tokens received from refresh');
      }

      localStorage.setItem('idToken', newIdToken);
      localStorage.setItem('accessToken', newAccessToken);
      
      setIdToken(newIdToken);
      setAccessToken(newAccessToken);
      clearError(); // Clear any existing errors on successful refresh
      
      scheduleTokenRefresh(newIdToken);
    } catch (error) {
      const errorType = error.message.includes('Network error') 
        ? AUTH_ERRORS.NETWORK_ERROR 
        : AUTH_ERRORS.REFRESH_FAILED;
      handleAuthError(error, errorType);
    }
  };

  const scheduleTokenRefresh = (token) => {
    if (!token) return;
    
    try {
      const { exp } = jwtDecode(token);
      const expiresIn = (exp * 1000) - Date.now() - TOKEN_REFRESH_MARGIN;
      
      if (expiresIn <= 0) {
        refreshTokens();
        return;
      }

      // Clear existing timer if any
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      // Set new timer
      const timer = setTimeout(refreshTokens, expiresIn);
      setRefreshTimer(timer);
    } catch (error) {
      console.error('Error scheduling token refresh:', error);
    }
  };

  const handleLogin = (tokens) => {
    try {
      const { idToken, accessToken, refreshToken: newRefreshToken } = tokens;
      
      if (!validateToken(idToken) || !validateToken(accessToken)) {
        throw new Error('Invalid tokens received during login');
      }
      
      localStorage.setItem('idToken', idToken);
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);
      
      setIdToken(idToken);
      setAccessToken(accessToken);
      setRefreshToken(newRefreshToken);
      clearError();
      
      scheduleTokenRefresh(idToken);
    } catch (error) {
      handleAuthError(error, AUTH_ERRORS.INVALID_TOKEN);
    }
  };

  const handleLogout = () => {
    // Clear tokens from localStorage
    localStorage.removeItem('idToken');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    
    // Clear state
    setIdToken(null);
    setAccessToken(null);
    setRefreshToken(null);
    
    // Clear refresh timer
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      setRefreshTimer(null);
    }
  };

  useEffect(() => {
    try {
      const storedIdToken = localStorage.getItem('idToken');
      const storedAccessToken = localStorage.getItem('accessToken');
      const storedRefreshToken = localStorage.getItem('refreshToken');
      
      if (storedIdToken && storedAccessToken && storedRefreshToken) {
        if (!validateToken(storedIdToken) || !validateToken(storedAccessToken)) {
          throw new Error('Invalid stored tokens');
        }
        
        setIdToken(storedIdToken);
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        
        if (isTokenExpired(storedIdToken)) {
          refreshTokens();
        } else {
          scheduleTokenRefresh(storedIdToken);
        }
      }
    } catch (error) {
      handleAuthError(error, AUTH_ERRORS.INVALID_TOKEN);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      idToken,
      accessToken,
      refreshToken,
      handleLogin,
      handleLogout,
      error,
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
} 