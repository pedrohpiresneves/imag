import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMagPrefs,
  getPushPublicKey,
  removePushSubscription,
  savePushSubscription,
  updateMagPrefs,
  type MagPrefsPatch,
} from "@/lib/push.functions";

export type PushStatus =
  | "loading"
  | "unsupported"
  | "needs-install"
  | "idle"
  | "granted"
  | "denied"
  | "error";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function bufferToBase64Url(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Inscrição Web Push real (VAPID) + preferências da MAG. */
export function useMagPush(enabledQuery = true) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: keyData } = useQuery({
    queryKey: ["push-public-key"],
    queryFn: () => getPushPublicKey(),
    staleTime: 1000 * 60 * 60,
  });

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["mag-prefs"],
    queryFn: () => getMagPrefs(),
    enabled: enabledQuery,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      setStatus(isIos() && !isStandalone() ? "needs-install" : "unsupported");
      return;
    }
    const permission = Notification.permission;
    setStatus(permission === "granted" ? "granted" : permission === "denied" ? "denied" : "idle");
  }, []);

  const enable = useCallback(async () => {
    setMessage(null);
    setBusy(true);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus(isIos() && !isStandalone() ? "needs-install" : "unsupported");
        return false;
      }
      if (isIos() && !isStandalone()) {
        setStatus("needs-install");
        return false;
      }
      const publicKey = keyData?.publicKey;
      if (!publicKey) {
        setMessage("Não foi possível ativar agora. Tente novamente.");
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "idle");
        return false;
      }

      const registration =
        (await navigator.serviceWorker.getRegistration("/")) ??
        (await navigator.serviceWorker.ready);
      if (!registration) {
        setMessage("Não foi possível ativar agora. Tente novamente.");
        return false;
      }

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        }));

      await savePushSubscription({
        data: {
          endpoint: subscription.endpoint,
          p256dh: bufferToBase64Url(subscription.getKey("p256dh")),
          auth: bufferToBase64Url(subscription.getKey("auth")),
          deviceLabel: navigator.platform || "web",
          platform: isIos() ? "ios" : "web",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

      setStatus("granted");
      await qc.invalidateQueries({ queryKey: ["mag-prefs"] });
      return true;
    } catch {
      setMessage("Não foi possível ativar as notificações. Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [keyData?.publicKey, qc]);

  const disable = useCallback(async () => {
    setMessage(null);
    setBusy(true);
    try {
      let endpoint: string | undefined;
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          endpoint = subscription.endpoint;
          await subscription.unsubscribe().catch(() => false);
        }
      }
      await removePushSubscription({ data: { endpoint } });
      await qc.invalidateQueries({ queryKey: ["mag-prefs"] });
    } catch {
      setMessage("Não foi possível desativar agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }, [qc]);

  const patch = useCallback(
    async (next: MagPrefsPatch) => {
      await updateMagPrefs({ data: next });
      await qc.invalidateQueries({ queryKey: ["mag-prefs"] });
    },
    [qc],
  );

  return {
    status,
    busy,
    message,
    setMessage,
    prefs,
    loading: isLoading,
    active: Boolean(prefs?.enabled && (prefs?.devices ?? 0) > 0 && status === "granted"),
    enable,
    disable,
    patch,
  };
}
