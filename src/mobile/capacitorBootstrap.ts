export async function bootstrapCapacitorRuntime() {
  if (typeof window === "undefined") return;

  const isNativeShell =
    (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
  if (!isNativeShell) return;

  const [{ App }, { Keyboard }, { StatusBar }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/keyboard"),
    import("@capacitor/status-bar"),
  ]);

  await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
  await Keyboard.setScroll({ isDisabled: false }).catch(() => undefined);

  App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) return;
    window.dispatchEvent(new Event("focus"));
  });

  Keyboard.addListener("keyboardWillShow", () => {
    document.body.classList.add("kb-open");
  });
  Keyboard.addListener("keyboardWillHide", () => {
    document.body.classList.remove("kb-open");
  });
}
