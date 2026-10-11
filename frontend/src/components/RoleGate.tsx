import React from 'react';
import { useAuth } from '../context/AuthContext';

interface RoleGateProps {
  roles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ roles, children, fallback = null }: RoleGateProps) {
  const { user } = useAuth();
  
  if (!user) return <>{fallback}</>;
  
  const userRole = user.role;
  const userTier = user.tier;
  
  const hasAccess = roles.some(role => {
    if (role === userRole) return true;
    if (role === userTier) return true;
    return false;
  });
  
  if (!hasAccess) return <>{fallback}</>;
  
  return <>{children}</>;
}

export function AdminOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return <RoleGate roles={['admin']} fallback={fallback}>{children}</RoleGate>;
}

export function HeadOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return <RoleGate roles={['admin', 'head_of_household']} fallback={fallback}>{children}</RoleGate>;
}

export function HeadOrMember({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return <RoleGate roles={['admin', 'head_of_household', 'household_member']} fallback={fallback}>{children}</RoleGate>;
}

export function useHasRole(roles: string[]): boolean {
  const { user } = useAuth();
  
  if (!user) return false;
  
  const userRole = user.role;
  const userTier = user.tier;
  
  return roles.some(role => {
    if (role === userRole) return true;
    if (role === userTier) return true;
    return false;
  });
}
