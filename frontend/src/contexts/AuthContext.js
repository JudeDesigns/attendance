import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Import the main API instance to share authentication
import { api } from '../services/api';

// Create a clean axios instance for auth
const authAPI = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Configure both API instances with authentication
  useEffect(() => {
    if (token) {
      authAPI.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Also update the main API instance
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete authAPI.defaults.headers.common['Authorization'];
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await authAPI.post('/auth/verify/', { token });
          if (response.data.valid) {
            // Get user profile
            const profileResponse = await authAPI.get('/auth/profile/');
            setUser(profileResponse.data);
          } else {
            logout();
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          logout();
        }
      }
      setLoading(false);
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async (username, password) => {
    try {
      const response = await authAPI.post('/auth/login/', {
        username,
        password,
      });

      const { access, refresh, user: userData } = response.data;

      setToken(access);
      setUser(userData);
      localStorage.setItem('token', access);
      localStorage.setItem('refreshToken', refresh);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.non_field_errors?.[0] || 'Login failed',
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    delete authAPI.defaults.headers.common['Authorization'];
    delete api.defaults.headers.common['Authorization'];
  };

  const refreshToken = async () => {
    try {
      const refresh = localStorage.getItem('refreshToken');
      if (!refresh) {
        logout();
        return false;
      }

      const response = await authAPI.post('/auth/refresh/', {
        refresh,
      });

      const { access } = response.data;
      setToken(access);
      localStorage.setItem('token', access);
      return true;
    } catch (error) {
      logout();
      return false;
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    refreshToken,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin || user?.employee_profile?.is_admin || false,
    isDriver: user?.is_driver || user?.employee_profile?.is_driver || false,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
