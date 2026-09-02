/**
 * Estado do tutorial guiado da MAG.
 * A conclusão vive no perfil do usuário (não só no navegador),
 * com espelho local para evitar piscar o overlay no primeiro render.
 */
import { supabase } from "@/integrations/supabase/client";

const LOCAL_KEY = "mag_tour_v1_done";
export const TOUR_RESTART_EVENT = "imag:restart-tour";

export function localTourDone(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(LOCAL_KEY) === "1";
  } catch {
    return false;
  }
}

function setLocalDone(done: boolean) {
  try {
    if (done) window.localStorage.setItem(LOCAL_KEY, "1");
    else window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

/** Já concluiu (ou pulou) o tutorial? Fonte de verdade: perfil. */
export async function fetchTourDone(): Promise<boolean | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("tour_completed_at, onboarding_completed_at")
    .eq("id", u.user.id)
    .maybeSingle();
  const row = data as
    | { tour_completed_at?: string | null; onboarding_completed_at?: string | null }
    | null;
  if (!row) return null;
  const done = Boolean(row.tour_completed_at);
  setLocalDone(done);
  return done;
}

export async function markTourDone() {
  setLocalDone(true);
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase
    .from("profiles")
    .update({ tour_completed_at: new Date().toISOString() })
    .eq("id", u.user.id);
}

/** Reabre o tutorial a partir do Perfil/Configurações. */
export async function restartTour() {
  setLocalDone(false);
  const { data: u } = await supabase.auth.getUser();
  if (u.user) {
    await supabase.from("profiles").update({ tour_completed_at: null }).eq("id", u.user.id);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TOUR_RESTART_EVENT));
  }
}
