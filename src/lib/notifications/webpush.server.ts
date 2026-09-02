/** Envio de Web Push real (VAPID + aes128gcm). Server-only. */
import { ApplicationServerKeys, generatePushHTTPRequest } from "webpush-webcrypto";

export type PushTarget = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  data: Record<string, unknown>;
};

let keysPromise: Promise<ApplicationServerKeys> | null = null;

export function webPushConfigured() {
  return Boolean(process.env["WEBPUSH_PUBLIC_KEY"] && process.env["WEBPUSH_PRIVATE_KEY"]);
}

export function webPushPublicKey() {
  return process.env["WEBPUSH_PUBLIC_KEY"] ?? null;
}

function getKeys() {
  if (!keysPromise) {
    const publicKey = process.env["WEBPUSH_PUBLIC_KEY"];
    const privateKey = process.env["WEBPUSH_PRIVATE_KEY"];
    if (!publicKey || !privateKey) throw new Error("webpush_keys_missing");
    keysPromise = ApplicationServerKeys.fromJSON({ publicKey, privateKey });
  }
  return keysPromise;
}

export type PushSendResult = { ok: boolean; status: number; gone: boolean };

/** Envia para um endpoint. `gone` indica inscrição inválida (404/410). */
export async function sendWebPush(
  target: PushTarget,
  payload: PushPayload,
  ttlSeconds = 60 * 60 * 6,
): Promise<PushSendResult> {
  const keys = await getKeys();
  const { headers, body, endpoint } = await generatePushHTTPRequest({
    applicationServerKeys: keys,
    payload: JSON.stringify(payload),
    target: {
      endpoint: target.endpoint,
      keys: { p256dh: target.p256dh, auth: target.auth },
    },
    adminContact: process.env["WEBPUSH_SUBJECT"] ?? "mailto:contato@imag.net.br",
    ttl: ttlSeconds,
    urgency: "normal",
  });

  const response = await fetch(endpoint, { method: "POST", headers, body });
  return {
    ok: response.ok,
    status: response.status,
    gone: response.status === 404 || response.status === 410,
  };
}
