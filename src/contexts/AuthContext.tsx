import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {apiFetch} from '../lib/api';
import type {PermissionCode, UserProfile} from '../lib/types';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string, mfaCode?: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  hasPerm: (perm: PermissionCode) => boolean;
  canAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applyAccessibilityClasses(user: UserProfile | null) {
  const root = document.documentElement;
  root.classList.toggle('a11y-large-text', Boolean(user?.accessibilityPrefs?.largeText));
  root.classList.toggle('a11y-high-contrast', Boolean(user?.accessibilityPrefs?.highContrast));
  root.classList.toggle('a11y-reduced-motion', Boolean(user?.accessibilityPrefs?.reducedMotion));
}

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<{authenticated: boolean; user: UserProfile | null}>('/api/auth/me');
      setUser(data.authenticated ? data.user : null);
      applyAccessibilityClasses(data.authenticated ? data.user : null);
    } catch {
      setUser(null);
      applyAccessibilityClasses(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string, mfaCode?: string) => {
    const data = await apiFetch<{authenticated: boolean; user: UserProfile}>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({email, password, mfaCode}),
    });
    setUser(data.user);
    applyAccessibilityClasses(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', {method: 'POST'});
    setUser(null);
    applyAccessibilityClasses(null);
  }, []);

  const hasPerm = useCallback(
    (perm: PermissionCode) => Boolean(user?.permissions?.includes(perm)),
    [user],
  );

  const canAdmin = Boolean(user?.permissions?.includes('admin:access'));

  return (
    <AuthContext.Provider value={{user, loading, refreshUser, login, logout, hasPerm, canAdmin}}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser utilizado dentro de AuthProvider.');
  return ctx;
}
