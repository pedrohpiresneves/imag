// Single, guarded service-worker registration wrapper.
// Never registers in dev, inside an iframe, or in Lovable preview hosts.

const SW_URL = "/sw.js?v=20260828-access";

function isPreviewHost(hostname: string): boolean {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

async function unregisterAppServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => (registration.active?.scriptURL ?? "").includes("/sw.js"))
      .map((registration) => registration.unregister()),
  );
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const swOff = new URLSearchParams(window.location.search).get("sw") === "off";
  const refused =
    !import.meta.env.PROD || inIframe || swOff || isPreviewHost(window.location.hostname);

  if (refused) {
    void unregisterAppServiceWorkers();
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(SW_URL, { scope: "/", updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => {});
  });
}
