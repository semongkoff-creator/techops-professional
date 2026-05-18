import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { User } from "../types";

const AUTH_BOOTSTRAP_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("auth_timeout")), ms);
    promise
      .then((value) => resolve(value))
      .catch((err) => reject(err))
      .finally(() => window.clearTimeout(timer));
  });
}

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
          try {
            const me = await withTimeout(api.me(), AUTH_BOOTSTRAP_TIMEOUT_MS);
            setUser(me as User);
            return;
          } catch {
            // Token local bisa kadaluarsa; coba restore dari refresh cookie.
            await withTimeout(api.refresh(), AUTH_BOOTSTRAP_TIMEOUT_MS);
            const me = await withTimeout(api.me(), AUTH_BOOTSTRAP_TIMEOUT_MS);
            setUser(me as User);
            return;
          }
        }
        // Silent login from refresh cookie (so user doesn't need to login again)
        await withTimeout(api.refresh(), AUTH_BOOTSTRAP_TIMEOUT_MS);
        const me = await withTimeout(api.me(), AUTH_BOOTSTRAP_TIMEOUT_MS);
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
