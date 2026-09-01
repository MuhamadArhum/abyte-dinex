import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface PermissionGuardProps {
  moduleKey: string;
  children: React.ReactNode;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({ moduleKey, children }) => {
  const { hasPermission, isLoading } = useAuth();

  if (isLoading) return null;

  if (!hasPermission(moduleKey)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default PermissionGuard;
