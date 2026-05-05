import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password, captchaToken) {
    const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password, captchaToken } });
    setToken(token);
    setUser(user);
    return user;
  }

  async function register(name, email, password, captchaToken) {
    const { token, user } = await api('/auth/register', { method: 'POST', body: { name, email, password, captchaToken } });
    setToken(token);
    setUser(user);
    return user;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  function impersonate(token, user) {
    setToken(token);
    setUser(user);
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, impersonate }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
