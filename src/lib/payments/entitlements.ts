import { supabase } from "@/integrations/supabase/client";

export async function fetchEntitlements(userId: string) {
  const { data } = await supabase
    .from("entitlements")
    .select("product_id, status, expires_at, granted_at")
    .eq("user_id", userId)
    .eq("status", "active");
  return data ?? [];
}

export async function hasProductAccess(userId: string, productId: string): Promise<boolean> {
  void userId;
  void productId;
  const { data, error } = await supabase.rpc("get_my_access_status");
  if (error) {
    console.warn("[entitlements] get_my_access_status falhou", error);
    return false;
  }
  return !!data && typeof data === "object" && "has_access" in data && data.has_access === true;
}