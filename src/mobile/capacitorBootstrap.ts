export async function bootstrapCapacitorRuntime() {
  if (typeof window === "undefined") return;

  const isNativeShell =
    (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;
  if (!isNativeShell) return;

  try {
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

  } catch {
    // Keep shell alive even if native helpers fail.
  }

  // Push setup enabled by default on native builds. Set VITE_ENABLE_PUSH_MOBILE=false to disable.
  const enablePush = import.meta.env.VITE_ENABLE_PUSH_MOBILE !== "false";
  if (!enablePush) return;

  try {
    const [{ PushNotifications }, { api }] = await Promise.all([
      import("@capacitor/push-notifications"),
      import("../services/api"),
    ]);
    const checked = await PushNotifications.checkPermissions().catch(() => ({ receive: "denied" as const }));
    const perm = checked.receive === "prompt"
      ? await PushNotifications.requestPermissions().catch(() => ({ receive: "denied" as const }))
      : checked;

    PushNotifications.addListener("registrationError", (err) => {
      // eslint-disable-next-line no-console
      console.error("Push registration error:", err);
    });

    if (perm.receive === "granted") {
      await PushNotifications.register().catch(() => undefined);
      PushNotifications.addListener("registration", async ({ value }) => {
        // eslint-disable-next-line no-console
        console.log("Push token registered:", value);
        try {
          await api.updatePushToken(value);
        } catch {
          // keep app stable even if token sync fails
        }
      });

      PushNotifications.addListener("pushNotificationReceived", (notification) => {
        window.dispatchEvent(new CustomEvent("push:received", { detail: notification }));
      });

      PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        window.dispatchEvent(new CustomEvent("push:action", { detail: action }));
      });
    }
  } catch {
    // Optional feature, ignore safely.
  }
}
