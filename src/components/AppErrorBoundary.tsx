import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  declare props: Readonly<Props>;
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("App runtime error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="center" style={{ minHeight: "100vh", padding: "24px", textAlign: "center" }}>
          <h2 style={{ marginBottom: "12px" }}>Aplikasi mengalami kendala</h2>
          <p style={{ marginBottom: "16px" }}>Silakan tutup lalu buka ulang aplikasi.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Muat Ulang
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
