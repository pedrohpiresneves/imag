// Onboarding automático pós-pagamento (idempotente).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWelcomeEmail } from "./welcome-email.server";

export interface OnboardResult {
  userId: string;
  created: boolean;
  actionLink?: string;
  tokenHash?: string;
}

async function findUserByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user?.id ?? null;
}

export async function onboardPaidCustomer(input: {
  email: string;
  productId: string;
  paymentId: string;
  orderId: string;
  redirectTo: string;
}): Promise<OnboardResult> {
  const email = input.email.toLowerCase().trim();

  let userId = await findUserByEmail(email);
  let created = false;
  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { onboarded_via: "payment" },
    });
    if (error) {
      if (error.message?.toLowerCase().includes("already")) {
        userId = await findUserByEmail(email);
      } else {
        throw error;
      }
    } else {
      userId = data.user.id;
      created = true;
    }
  }
  if (!userId) throw new Error("Falha ao criar/localizar usuário");

  await supabaseAdmin
    .from("orders")
    .update({ user_id: userId, status: "paid" })
    .eq("id", input.orderId);

  await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      email,
      has_access: true,
      access_type: "annual",
      access_granted_at: new Date().toISOString(),
      subscription_status: "active",
      subscription_started_at: new Date().toISOString(),
      subscription_renews_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { onConflict: "id" },
  );

  await supabaseAdmin.from("entitlements").upsert(
    {
      user_id: userId,
      product_id: input.productId,
      source: "payment",
      source_ref: input.paymentId,
      status: "active",
      expires_at: null,
    },
    { onConflict: "user_id,product_id,source_ref" },
  );

  const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: input.redirectTo },
  });

  try {
    await sendWelcomeEmail({
      email,
      actionLink: linkData?.properties?.action_link ?? input.redirectTo,
      created,
    });
  } catch (e) {
    console.error("[onboarding] welcome email falhou (não crítico):", e);
  }

  return {
    userId,
    created,
    actionLink: linkData?.properties?.action_link,
    tokenHash: linkData?.properties?.hashed_token,
  };
}