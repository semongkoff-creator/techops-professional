import { useState } from "react";

export function LoginPage({ onLogin }: { onLogin: (u: string, p: string) => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="login-wrap d-flex align-items-center justify-content-center min-vh-100">
      <form
        className="login-card card shadow-lg border-0"
        autoComplete="off"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await onLogin(username, password);
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <div className="card-body login-card-body">
          <div className="login-logo-wrap mx-auto mb-3">
            <img src="/assets/logo-satria.jpg" alt="Satria Piranti Perkasa" className="login-logo-img" />
          </div>
          <h1 className="text-center fw-bold mb-1 login-title">Satria Login</h1>
          <p className="text-center text-secondary mb-4 login-subtitle">Sistem Manajemen Operasional Terpadu</p>

          <label htmlFor="username" className="form-label fw-bold small text-secondary mb-2 login-label">USERNAME</label>
          <input
            id="username"
            className="form-control form-control-lg rounded-pill py-3 px-4 mb-3 login-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="teknisi / staff / supervisor"
            autoComplete="username"
            required
          />

          <label htmlFor="password" className="form-label fw-bold small text-secondary mb-2 login-label">PASSWORD</label>
          <div className="position-relative mb-3">
            <input
              id="password"
              className="form-control form-control-lg rounded-pill py-3 px-4 pe-5 login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-secondary text-decoration-none me-2 p-0"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7c2 0 3.7.6 5.1 1.5" />
                  <path d="M22 12s-3.5 7-10 7c-2 0-3.7-.6-5.1-1.5" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7c6.5 0 10 7 10 7s-3.5 7-10 7c-6.5 0-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                  <line x1="4" y1="4" x2="20" y2="20" />
                </svg>
              )}
            </button>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <button type="submit" className="btn btn-primary btn-lg w-100 rounded-pill fw-semibold py-3 mb-4 login-submit-btn">
            Login
          </button>

        </div>
      </form>
    </div>
  );
}
