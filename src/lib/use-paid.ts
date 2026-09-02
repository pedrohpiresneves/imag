import { useEffect, useState } from "react";
import { useRouteContext } from "@tanstack/react-router";
import { hasProductAccess } from "@/lib/payments/entitlements";
import { PRODUCT_ID } from "@/lib/payments/products";

export function usePaid() {
  const ctx = useRouteContext({ strict: false }) as { user?: { id: string } };
  const userId = ctx?.user?.id;
  const [isPaid, setIsPaid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsPaid(false);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    hasProductAccess(userId, PRODUCT_ID)
      .then((access) => {
        if (!cancelled) setIsPaid(access);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { isPaid, isLoading };
}