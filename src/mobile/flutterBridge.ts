export type NativeMediaPayload = {
  type: 'media_selected';
  name: string;
  mime: string;
  base64: string;
};

export type NativeNotificationPayload = {
  deep_link?: string;
  [key: string]: unknown;
};

export type NativeUploadResultPayload = {
  ok: boolean;
  documentation_image_url?: string;
  message?: string;
};

declare global {
  interface Window {
    __TECHOPS_NATIVE_BRIDGE_READY__?: boolean;
  }
}

function ensureBridgeReadyListener() {
  if ((window as Window & { __TECHOPS_NATIVE_BRIDGE_LISTENER__?: boolean }).__TECHOPS_NATIVE_BRIDGE_LISTENER__) return;
  window.addEventListener("native-bridge-ready", () => {
    window.__TECHOPS_NATIVE_BRIDGE_READY__ = true;
  });
  (window as Window & { __TECHOPS_NATIVE_BRIDGE_LISTENER__?: boolean }).__TECHOPS_NATIVE_BRIDGE_LISTENER__ = true;
}

export function requestNativeMediaPicker(): void {
  ensureBridgeReadyListener();
  const bridge = (window as unknown as { NativeBridge?: { postMessage: (v: string) => void } }).NativeBridge;
  if (!bridge) return;
  bridge.postMessage(JSON.stringify({ type: 'pick_media' }));
}

export function isNativeBridgeAvailable(): boolean {
  ensureBridgeReadyListener();
  const bridge = (window as unknown as { NativeBridge?: { postMessage: (v: string) => void } }).NativeBridge;
  if (typeof bridge?.postMessage === "function") return true;
  return window.__TECHOPS_NATIVE_BRIDGE_READY__ === true;
}

export function isLikelyNativeWebView(): boolean {
  const ua = navigator.userAgent || "";
  return /Android/i.test(ua) && (/wv/i.test(ua) || /Version\/\d+\.\d+ Chrome\/\d+/i.test(ua));
}

export function requestNativeTaskMediaUpload(payload: {
  upload_url: string;
  bearer_token: string;
  task_id?: string;
  device_id?: string;
}): void {
  ensureBridgeReadyListener();
  const bridge = (window as unknown as { NativeBridge?: { postMessage: (v: string) => void } }).NativeBridge;
  if (!bridge) return;
  bridge.postMessage(JSON.stringify({ type: "upload_task_media", ...payload }));
}

export function registerNativeBridgeListeners(
  onMedia: (payload: NativeMediaPayload) => void,
  onNotification: (payload: NativeNotificationPayload) => void,
  onUploadResult?: (payload: NativeUploadResultPayload) => void,
): () => void {
  const mediaHandler = (event: Event) => {
    const customEvent = event as CustomEvent<NativeMediaPayload>;
    onMedia(customEvent.detail);
  };

  const notifHandler = (event: Event) => {
    const customEvent = event as CustomEvent<NativeNotificationPayload>;
    onNotification(customEvent.detail);
  };
  const uploadResultHandler = (event: Event) => {
    if (!onUploadResult) return;
    const customEvent = event as CustomEvent<NativeUploadResultPayload>;
    onUploadResult(customEvent.detail);
  };

  window.addEventListener('native-media', mediaHandler);
  window.addEventListener('native-notification', notifHandler);
  window.addEventListener('native-upload-result', uploadResultHandler);

  return () => {
    window.removeEventListener('native-media', mediaHandler);
    window.removeEventListener('native-notification', notifHandler);
    window.removeEventListener('native-upload-result', uploadResultHandler);
  };
}
