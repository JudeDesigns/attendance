import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false, requiredPermission = null }) => {
  const { loading, isAuthenticated, isAdmin, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin) {
    let accessDenied = false;

    if (requiredPermission) {
      // If a specific permission is required, check it (full admins automatically pass this)
      if (!hasPermission(requiredPermission)) {
        accessDenied = true;
      }
    } else {
      // If no granular permission is specified, but requireAdmin is true,
      // ONLY full admins are allowed (fallback security). Sub-admins are blocked.
      if (!isAdmin) {
        accessDenied = true;
      }
    }

    if (accessDenied) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;
