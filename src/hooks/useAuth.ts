import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { User } from "../types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onExpired = () => {
      localStorage.removeItem("token");
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("auth:expired", onExpired as EventListener);

    const token = localStorage.getItem("token");
    const bootstrapAuth = async () => {
      try {
        if (token) {
          const me = await api.me();
          setUser(me as User);
          return;
        }
        // Silent login from refresh cookie (so user doesn't need to login again)
        await api.refresh();
        const me = await api.me();
        setUser(me as User);
      } catch {
        localStorage.removeItem("token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    void bootstrapAuth();

    return () => window.removeEventListener("auth:expired", onExpired as EventListener);
  }, []);

  async function login(username: string, password: string) {
    const r = await api.login({ username, password });
    localStorage.setItem("token", r.token);
    const me = await api.me();
    setUser(me as User);
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      // ignore network/logout endpoint errors, still clear local session
    }
    localStorage.removeItem("token");
    setUser(null);
  }

  return { user, setUser, loading, login, logout };
}
