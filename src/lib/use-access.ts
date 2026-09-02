import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasProductAccess } from "@/lib/payments/entitlements";
import { PRODUCT_ID } from "@/lib/payments/products";

/**
 * Access state for any route (public or protected).
 * Anonymous → { isLoggedIn: false, isPaid: false }.
 */
export function useAccess() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [paidLoading, setPaidLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setEmail(session?.user?.email ?? null);
      if (!session?.user) setIsPaid(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsPaid(false);
      setPaidLoading(false);
      return;
    }
    let cancelled = false;
    setPaidLoading(true);
    hasProductAccess(userId, PRODUCT_ID)
      .then((access) => {
        if (!cancelled) setIsPaid(access);
      })
      .catch((error) => {
        console.warn("[useAccess] access check", error);
        if (!cancelled) setIsPaid(false);
      })
      .finally(() => {
        if (!cancelled) setPaidLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    userId,
    email,
    isLoggedIn: !!userId,
    isPaid,
    isLoading: !ready || (!!userId && paidLoading),
  };
}