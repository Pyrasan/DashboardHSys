import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api';
import { AuthContextType, User } from '../types';

const AuthContext = createContext<AuthContextType | null>(null);

const ACCESS_MAP: Record<string, string[]> = {
  admin: ['/app', '/app/detection', '/app/stats', '/app/guest', '/app/command', '/app/temporary', '/app/vp-management', '/app/registrations', '/app/residents', '/app/notifications', '/app/my-household', '/app/active-vehicles', '/app/active-vehicles/household', '/app/active-vehicles/guests', '/app/session-timeline', '/app/head-approvals', '/app/profile'],
  head_of_household: ['/app', '/app/detection', '/app/stats', '/app/temporary', '/app/vp-management', '/app/my-household', '/app/active-vehicles', '/app/active-vehicles/household', '/app/active-vehicles/guests', '/app/session-timeline', '/app/head-approvals', '/app/notifications', '/app/profile'],
  household_member: ['/app', '/app/detection', '/app/stats', '/app/temporary', '/app/my-household', '/app/session-timeline', '/app/notifications', '/app/profile'],
  general: ['/', '/detection']
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      api.checkAuth(sessionId).then((res: any) => {
        if (res.authenticated) {
          const role = res.user.role;
          let tier: User['tier'] = 'resident';
          if (role === 'admin') tier = 'admin';
          else if (role === 'head_of_household' || role === 'household_member') tier = 'resident';
          setUser({ ...res.user, sessionId, tier, role });
        }
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res: any = await api.login(username, password);
      if (res && res.ok) {
        const role = res.user.role;
        let tier: User['tier'] = 'resident';
        if (role === 'admin') tier = 'admin';
        else if (role === 'head_of_household' || role === 'household_member') tier = 'resident';
        localStorage.setItem('sessionId', res.sessionId);
        setUser({ ...res.user, sessionId: res.sessionId, tier, role });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      try {
        await api.logout(sessionId);
      } catch {
        // silent
      }
    }
    localStorage.removeItem('sessionId');
    setUser({ tier: 'general', username: 'Guest', role: '' });
  };

  const hasAccess = (path: string): boolean => {
    const role = user?.role || 'general';
    const allowedPaths = ACCESS_MAP[role] || ACCESS_MAP.general;
    return allowedPaths.some(p => path === p);
  };

  const isAuthenticated = (): boolean => {
    return !!(user && (user.tier === 'admin' || user.tier === 'resident'));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasAccess, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
