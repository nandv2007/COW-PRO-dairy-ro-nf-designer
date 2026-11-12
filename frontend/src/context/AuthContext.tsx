"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getStoredToken, setStoredToken } from "@/lib/api";
import type { PreferredUnits, UserProfile } from "@/types/cowpro";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  updateUnits: (units: Partial<PreferredUnits>) => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        // Also check HTTP-only cookie session
        const res = await api.auth.me();
        setUser(res.user);
      } else {
        const res = await api.auth.me();
        setUser(res.user);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.auth
      .me()
      .then((res) => {
        if (active) setUser(res.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string, rememberMe: boolean) => {
    const res = await api.auth.login({ email, password, remember_me: rememberMe });
    setStoredToken(res.access_token, rememberMe);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setStoredToken(null);
      setUser(null);
    }
  };

  const updateUnits = async (units: Partial<PreferredUnits>) => {
    const res = await api.auth.updateMe({ preferred_units: units });
    setUser(res.user);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, refreshUser, login, logout, updateUnits, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
