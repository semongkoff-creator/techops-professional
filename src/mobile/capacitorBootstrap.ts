export async function bootstrapCapacitorRuntime() {
  if (typeof window === "undefined") return;

  const isNativeShell =
    (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
  if (!isNativeShell) return;

  const [{ App }, { Keyboard }, { StatusBar }, { PushNotifications }, { api }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/keyboard"),
    import("@capacitor/status-bar"),
    import("@capacitor/push-notifications"),
    import("../services/api"),
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

  const perm = await PushNotifications.requestPermissions().catch(() => ({ receive: "denied" as const }));
  if (perm.receive === "granted") {
    await PushNotifications.register().catch(() => undefined);
    PushNotifications.addListener("registration", async ({ value }) => {
      try {
        await api.updatePushToken(value);
      } catch {
        // keep app stable even if token sync fails
      }
    });
  }
}
