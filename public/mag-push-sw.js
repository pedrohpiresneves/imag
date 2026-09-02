/* Handlers de Web Push da iMAG.
   Importado pelo service worker gerado (workbox.importScripts) para não
   interferir no cache offline existente. */

const ICON = "/mag-app-icon-v4-192.png";
const BADGE = "/mag-app-icon-v4-64.png";

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "MAG", body: event.data ? event.data.text() : "" };
  }

  const data = payload.data || {};
  const expiresAt = data.expiresAt ? Date.parse(data.expiresAt) : null;
  if (expiresAt && Number.isFinite(expiresAt) && expiresAt < Date.now()) return;

  const title = payload.title || "MAG";
  const options = {
    body: payload.body || "",
    icon: ICON,
    badge: BADGE,
    tag: payload.tag || data.type || "mag",
    renotify: false,
    requireInteraction: false,
    data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const route = typeof data.targetRoute === "string" && data.targetRoute ? data.targetRoute : "/hoje";
  const target = new URL(route, self.location.origin).href;

  event.waitUntil(
    (async () => {
      if (data.notificationId) {
        try {
          await fetch("/api/public/notifications/opened", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: data.notificationId }),
          });
        } catch {
          /* abertura é telemetria: nunca bloqueia a navegação */
        }
      }

      const clientsList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ("navigate" in client) {
          try {
            await client.navigate(target);
          } catch {
            client.postMessage({ type: "mag-navigate", url: target });
          }
        } else {
          client.postMessage({ type: "mag-navigate", url: target });
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
