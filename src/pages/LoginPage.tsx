import { useState } from "react";

export function LoginPage({ onLogin }: { onLogin: (u: string, p: string) => Promise<void> }) {
  const [username, setUsername] = useState("atasan1");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const demoAccounts = [
    { label: "TEKNISI", value: "teknisi1" },
    { label: "SUPERVISOR", value: "spv1" },
    { label: "ATASAN", value: "atasan1" },
  ];

  return (
    <div className="login-wrap d-flex align-items-center justify-content-center min-vh-100">
      <form
        className="login-card card shadow-lg border-0"
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
          <div className="login-logo mx-auto mb-3" aria-hidden="true">TP</div>
          <h1 className="text-center fw-bold mb-1 login-title">TechOps LOGIN</h1>
          <p className="text-center text-secondary mb-4 login-subtitle">Sistem Manajemen Operasional Terpadu</p>

          <label htmlFor="username" className="form-label fw-bold small text-secondary mb-2 login-label">USERNAME</label>
          <input
            id="username"
            className="form-control form-control-lg rounded-pill py-3 px-4 mb-3 login-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="teknisi / supervisor / atasan"
            required
          />

          <label htmlFor="password" className="form-label fw-bold small text-secondary mb-2 login-label">PASSWORD</label>
          <input
            id="password"
            className="form-control form-control-lg rounded-pill py-3 px-4 mb-3 login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            type="password"
            required
          />

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <button type="submit" className="btn btn-primary btn-lg w-100 rounded-pill fw-semibold py-3 mb-4 login-submit-btn">
            Masuk ke Dashboard
          </button>

          <div className="demo">
            <div className="demo-title text-center mb-2">AKUN DEMO</div>
            <div className="demo-buttons d-grid gap-2 d-md-flex">
              {demoAccounts.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className="btn btn-light border fw-semibold flex-fill demo-btn"
                  onClick={() => {
                    setUsername(item.value);
                    setPassword("password");
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
