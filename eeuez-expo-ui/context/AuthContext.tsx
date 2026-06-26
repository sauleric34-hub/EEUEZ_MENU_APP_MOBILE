import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import * as authService from '../services/authService';

type AuthContextType = {
  user: any;
  isLoggedIn: boolean;
  login: (credentials: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const loggedIn = await authService.isLoggedIn();
      setIsLoggedIn(loggedIn);
      if (loggedIn) {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const login = async (credentials: any) => {
    await authService.login(credentials.email, credentials.password);
    await checkAuth();
  };

  const register = async (data: any) => {
    await authService.registerClient(data);
    await checkAuth();
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
