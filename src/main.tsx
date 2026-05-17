import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import { bootstrapCapacitorRuntime } from "./mobile/capacitorBootstrap";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

window.addEventListener("unhandledrejection", (event) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection:", event.reason);
});
window.addEventListener("error", (event) => {
  // eslint-disable-next-line no-console
  console.error("Global error:", event.error ?? event.message);
});

void bootstrapCapacitorRuntime().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Capacitor bootstrap failed:", err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
