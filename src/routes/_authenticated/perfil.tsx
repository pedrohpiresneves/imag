import { createFileRoute, Link } from "@tanstack/react-router";
import { AppearanceToggle } from "@/components/mag/AppearanceToggle";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  X,
  AtSign,

  History,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Settings,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/use-access";
import { track } from "@/lib/analytics";
import { useServerFn } from "@tanstack/react-start";
import { getAntennaState } from "@/lib/antenna.functions";
import { levelForMagnetos } from "@/lib/antenna";
import { toast } from "sonner";
import { useSubscriptionState } from "@/lib/subscription-state";

/** Linha discreta com o período gratuito restante. */
function TrialLine() {
  const { data, isLoading } = useSubscriptionState();
  if (isLoading || !data) return null;
  if (data.state !== "trialing") return null;
  const days = data.daysRemaining;
  if (days === null) return null;
  return (
    <p className="mt-3 px-1 text-[12.5px]" style={{ color: "#737373" }}>
      Período gratuito:{" "}
      <span style={{ color: "#335CFF", fontWeight: 500 }}>
        {days} {days === 1 ? "dia restante" : "dias restantes"}
      </span>
    </p>
  );
}



export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil · iMAG" },
      { name: "description", content: "Sua identidade profissional e sua evolução estratégica na iMAG." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PerfilPage,
});

type Profile = {
  id: string;
  full_name: string | null;
  organize_areas?: string | null;

  avatar_url: string | null;
  profession: string | null;
  city: string | null;
  area: string | null;
  challenge: string | null;
  goal: string | null;
  created_at: string;
  onboarding_completed_at: string | null;
  handle: string | null;
};

const MONO: React.CSSProperties = { fontFamily: "var(--font-mono)" };
const DISPLAY: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  letterSpacing: "-0.03em",
};

const BLUE = "#1E56E0";
const BLUE_SOFT = "#EFF4FF";
const INK = "#0A0A0A";
const MUTED = "#6E6E73";
const FAINT = "#A1A1A6";
const BORDER = "#EFEFF0";

function PerfilPage() {
  const { userId } = useAccess();
  const [editing, setEditing] = useState(false);
  const fetchAntenna = useServerFn(getAntennaState);
  const { data: antenna } = useQuery({
    queryKey: ["antenna-state"],
    queryFn: () => fetchAntenna({}),
    staleTime: 30_000,
    retry: false,
  });
  const magnetos = antenna?.total ?? 0;
  const antennaLevel = levelForMagnetos(magnetos);


  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["perfil-min", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Profile | null;
    },
    enabled: !!userId,
  });

  const { data: magneticProfile } = useQuery({
    queryKey: ["perfil-magnetic-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("magnetic_profile")
        .select("audience, objectives, communication, business, identity")
        .eq("user_id", userId!)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!userId,
  });

  const pick = (obj: unknown, ...keys: string[]): string | null => {
    if (!obj || typeof obj !== "object") return null;
    const rec = obj as Record<string, unknown>;
    for (const k of keys) {
      const v = rec[k];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (Array.isArray(v) && v.length) return v.filter(Boolean).join(", ");
    }
    return null;
  };
  const mp = (magneticProfile ?? {}) as Record<string, unknown>;

  const strategic = useMemo(
    () => {
      const LIFE_AREAS = ["Trabalho", "Finanças", "Saúde", "Relacionamentos", "Rotina"];
      const raw = ((profile as any)?.organize_areas ?? "") as string;
      const areas = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) =>
          LIFE_AREAS.some((a) => a.toLowerCase() === s.toLowerCase()),
        );
      return [
        {
          label: "Foco atual",
          value:
            profile?.goal?.trim() ||
            pick(mp.objectives, "focus", "foco", "goal", "objetivo", "primary", "current"),
          tags: false,
        },
        {
          label: "Áreas que deseja organizar",
          value: areas.length ? areas.join(", ") : null,
          tags: true,
        },
      ];
    },
    [profile, magneticProfile],
  );

  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = profile?.avatar_url;
      if (!raw) {
        setAvatarSrc(null);
        return;
      }
      if (raw.startsWith("http")) {
        setAvatarSrc(raw);
        return;
      }
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(raw, 60 * 60 * 24);
      if (alive) setAvatarSrc(data?.signedUrl ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [profile?.avatar_url]);

  if (isLoading || !profile) {
    return (
      <div
        className="relative min-h-screen fade-rise"
        style={{ background: "#FFFFFF", color: INK, fontFamily: "var(--font-sans)" }}
      >
        <main className="mx-auto max-w-xl px-6 pt-10 text-sm text-[#A1A1A6]">Carregando…</main>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen overflow-x-hidden fade-rise"
      style={{ background: "#FFFFFF", color: INK, fontFamily: "var(--font-sans)" }}
    >
      <PageHeader
        title="Perfil"
        right={
          <Link
            to="/configuracoes"
            aria-label="Configurações"
            className="grid h-10 w-10 place-items-center rounded-full transition active:opacity-60"
            style={{ color: BLUE }}
          >
            <Settings className="h-[19px] w-[19px]" strokeWidth={1.7} />
          </Link>
        }
      />


      <main className="relative mx-auto max-w-[520px] px-5 pt-5 pb-16 sm:px-6">

        {/* Cabeçalho */}
        <section className="flex flex-col items-center text-center">
          <div
            className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full grid place-items-center"
            style={{ background: "#F5F5F7", boxShadow: "0 0 0 1px rgba(10,10,10,0.06)" }}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={profile.full_name ?? "Foto de perfil"}
                width={88}
                height={88}
                loading="eager"
                decoding="async"
                className="h-[88px] w-[88px] object-cover object-center"
                onError={() => setAvatarSrc(null)}
              />
            ) : (
              <Camera className="h-6 w-6" style={{ color: FAINT }} strokeWidth={1.5} />
            )}
          </div>

          <h1
            className="mt-3 max-w-full break-words text-[21px] font-semibold leading-[1.15] sm:text-[23px]"
            style={DISPLAY}
          >
            {profile.full_name?.trim() || "Sem nome"}
          </h1>
          {profile.profession?.trim() && (
            <p className="mt-1 text-[14px]" style={{ color: MUTED }}>
              {profile.profession.trim()}
            </p>
          )}
          {profile.city?.trim() && (
            <p className="mt-0.5 text-[13px]" style={{ color: FAINT }}>
              {profile.city.trim()}
            </p>
          )}
          {profile.handle && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[13px]">
              <AtSign className="h-[13px] w-[13px]" style={{ color: BLUE }} strokeWidth={2} />
              <span className="font-medium" style={{ color: BLUE }}>
                im.{profile.handle}
              </span>
            </p>
          )}

          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3.5 inline-flex items-center rounded-full px-5 py-2 text-[13.5px] font-medium transition active:scale-[0.98]"
            style={{ background: BLUE_SOFT, color: BLUE }}
          >
            Editar perfil
          </button>
        </section>

        <Link
          to="/antenas"
          className="mt-6 flex items-center gap-3 border-t border-b px-1 py-3.5 transition active:opacity-70"
          style={{ borderColor: BORDER }}
        >
          <span
            className="h-[12px] w-[12px] shrink-0 rounded-full"
            style={{
              background: antennaLevel.fill,
              boxShadow: `0 0 10px ${antennaLevel.glow}${antennaLevel.ring ? `, 0 0 0 1px ${antennaLevel.ring}` : ""}`,
            }}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-medium" style={{ color: INK }}>
              {antennaLevel.name}
            </span>
            <span className="mt-0.5 block text-[12.5px]" style={{ color: MUTED }}>
              {magnetos.toLocaleString("pt-BR")} Magnetos
            </span>
          </span>
          <ChevronRight className="h-[15px] w-[15px]" style={{ color: FAINT }} strokeWidth={1.9} />
        </Link>

        <TrialLine />





        {/* Perfil estratégico */}
        {strategic.some((f) => !!f.value) && (
          <section className="mt-7">
            <h3
              className="px-1 text-[12px] font-medium uppercase tracking-[0.14em]"
              style={{ color: FAINT }}
            >
              Seu momento
            </h3>
            <div className="mt-2 divide-y px-1" style={{ borderColor: BORDER }}>
              {strategic
                .filter((f) => !!f.value)
                .map((f) => {
                  const tags = f.tags && f.value ? f.value.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
                  return (
                    <div key={f.label} className="py-3">
                      <span className="block text-[12.5px]" style={{ color: MUTED }}>
                        {f.label}
                      </span>
                      {tags.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {tags.map((t: string) => (
                            <span
                              key={t}
                              className="rounded-full px-2.5 py-1 text-[12.5px] font-medium"
                              style={{ background: BLUE_SOFT, color: BLUE }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span
                          className="mt-1 block text-[14px] font-medium leading-[1.4]"
                          style={{ color: INK }}
                        >
                          {f.value}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        {/* Minha evolução */}
        <section className="mt-7">
          <h3
            className="px-1 text-[12px] font-medium uppercase tracking-[0.14em]"
            style={{ color: FAINT }}
          >
            Sua jornada
          </h3>
          <ul className="mt-2 divide-y px-1" style={{ borderColor: BORDER }}>
            {[
              { to: "/historico", label: "Histórico", Icon: History },
              { to: "/resumo-semanal", label: "Resumo iMAG", Icon: Sparkles },
            ].map(({ to, label, Icon }) => (
              <li key={to} style={{ borderColor: BORDER }}>
                <Link
                  to={to}
                  className="flex items-center gap-3 py-3.5 transition active:opacity-70"
                >
                  <Icon className="h-[16px] w-[16px]" style={{ color: BLUE }} strokeWidth={1.9} />
                  <span className="flex-1 text-[14px]" style={{ color: INK }}>
                    {label}
                  </span>
                  <ChevronRight className="h-[15px] w-[15px]" style={{ color: FAINT }} strokeWidth={1.9} />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Aparência */}
        <section className="mt-7">
          <h3
            className="px-1 text-[12px] font-medium uppercase tracking-[0.14em]"
            style={{ color: FAINT }}
          >
            Aparência
          </h3>
          <p className="mt-2 px-1 text-[13px]" style={{ color: FAINT }}>
            Escolha o tema da MAG. Sua preferência fica salva neste dispositivo.
          </p>
          <div className="mt-2.5 px-1">
            <AppearanceToggle />
          </div>
        </section>


      </main>

      {editing && (
        <EditModal
          profile={profile}
          avatarSrc={avatarSrc}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  profile,
  avatarSrc,
  onClose,
  onSaved,
}: {
  profile: Profile;
  avatarSrc: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: profile.full_name ?? "",
    profession: profile.profession ?? "",
    city: profile.city ?? "",
    area: cleanProfessionalArea(profile.area ?? ""),
    goal: profile.goal ?? "",
    organize_areas: (profile as any).organize_areas ?? "",
  });

  const [preview, setPreview] = useState<string | null>(avatarSrc);
  const [avatarPath, setAvatarPath] = useState<string | null>(profile.avatar_url ?? null);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const initial = useRef({
    full_name: profile.full_name ?? "",
    profession: profile.profession ?? "",
    city: profile.city ?? "",
    area: cleanProfessionalArea(profile.area ?? ""),
    goal: profile.goal ?? "",
    organize_areas: (profile as any).organize_areas ?? "",
  });
  const dirty =
    JSON.stringify(form) !== JSON.stringify(initial.current) ||
    avatarPath !== (profile.avatar_url ?? null);
  function requestClose() {
    if (dirty) setConfirmClose(true);
    else onClose();
  }
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24);
      setAvatarPath(path);
      setPreview(data?.signedUrl ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        full_name: form.full_name.trim() || null,
        profession: form.profession.trim() || null,
        city: form.city.trim() || null,
        area: cleanProfessionalArea(form.area) || null,
        goal: form.goal.trim() || null,
        organize_areas: form.organize_areas.trim() || null,
        avatar_url: avatarPath,
      };

      const { error: upErr } = await supabase
        .from("profiles")
        .update(payload as any)
        .eq("id", profile.id);
      if (upErr) throw upErr;
      track("profile_updated");
      toast.success("Perfil atualizado.");
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] overflow-x-hidden bg-black/50 backdrop-blur"
      role="dialog"
      aria-modal
    >
      <div
        className="mx-auto flex h-full w-full max-w-[560px] flex-col overflow-x-hidden bg-white sm:my-6 sm:h-[calc(100%-3rem)] sm:rounded-[24px] sm:border sm:border-[#EDECE8]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-start justify-between px-6 pb-3 pt-4">
          <h3 className="text-[20px] font-semibold text-[#0A0A0A]" style={DISPLAY}>
            Editar perfil
          </h3>
          <button
            onClick={requestClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#EDECE8] text-[#6E6E73] hover:text-[#0A0A0A]"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6">
          <div className="mt-2 flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-[#EDECE8] bg-[#F7F7F7]">
              {preview ? (
                <img src={preview} alt="Prévia" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-6 w-6 text-[#8A8A90]" strokeWidth={1.5} />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center rounded-full border border-[#EDECE8] px-5 py-2.5 text-[13px] font-medium text-[#0A0A0A] hover:border-[#B08A44] hover:text-[#B08A44] disabled:opacity-60"
            >
              {uploading ? "Enviando…" : preview ? "Trocar foto" : "Enviar foto"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="mt-6 grid gap-4">
            <Field label="Nome" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
            <Field label="Profissão" value={form.profession} onChange={(v) => setForm({ ...form, profession: v })} />
            <Field label="Cidade" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <Field label="Foco atual" value={form.goal} onChange={(v) => setForm({ ...form, goal: v })} />
            <Field
              label="Atuação profissional"
              value={form.area}
              multiline
              onChange={(v) => setForm({ ...form, area: v })}
            />
            <AreasField
              value={form.organize_areas}
              onChange={(v) => setForm({ ...form, organize_areas: v })}
            />
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {confirmClose && (
            <div className="mt-5 rounded-[16px] border border-[#EDECE8] bg-[#FAFAFA] p-4">
              <p className="text-[14px] font-medium text-[#0A0A0A]">Descartar alterações?</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] rounded-full border border-[#EDECE8] px-4 text-[13px] font-medium text-[#6E6E73]"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClose(false)}
                  className="min-h-[40px] rounded-full bg-[#0A0A0A] px-4 text-[13px] font-medium text-white"
                >
                  Continuar editando
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className="border-t border-[#EDECE8] bg-white px-6 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="min-h-[48px] w-full rounded-full text-[14px] font-medium text-white transition disabled:opacity-60"
            style={{ background: BLUE }}
          >
            {saving ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

const AREAS = [
  "Trabalho",
  "Finanças",
  "Saúde",
  "Relacionamentos",
  "Rotina",
] as const;

/** Mantém apenas a atuação profissional, removendo áreas da vida herdadas do onboarding. */
function cleanProfessionalArea(raw: string) {
  const drop = [
    "trabalho",
    "finanças",
    "financas",
    "saúde",
    "saude",
    "relacionamentos",
    "rotina",
    "vida pessoal",
    "vida profissional",
  ];
  return raw
    .split(/[,·|]/)
    .map((s) => s.trim())
    .filter((s) => s && !drop.includes(s.toLowerCase()))
    .join(", ");
}

/** Seleção múltipla de áreas, salva como texto separado por vírgula. */
function AreasField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const toggle = (area: string) => {
    const next = selected.includes(area)
      ? selected.filter((a) => a !== area)
      : [...selected, area];
    onChange(next.join(", "));
  };
  return (
    <div>
      <span
        className="text-[11px] uppercase tracking-[0.22em] text-[#8A8A90] font-medium"
        style={MONO}
      >
        Áreas que deseja organizar
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        {AREAS.map((area) => {
          const on = selected.includes(area);
          return (
            <button
              key={area}
              type="button"
              onClick={() => toggle(area)}
              className="min-h-[36px] rounded-full border px-3.5 text-[13px] transition active:opacity-70"
              style={{
                borderColor: on ? "#335CFF" : "#EDECE8",
                background: on ? "#EEF3FF" : "#FFFFFF",
                color: on ? "#335CFF" : "#4A4A50",
              }}
            >
              {area}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span
        className="text-[11px] uppercase tracking-[0.22em] text-[#8A8A90] font-medium"
        style={MONO}
      >
        {label}
      </span>
      {multiline ? (
        <textarea
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full resize-none break-words rounded-[14px] border border-[#EDECE8] bg-[#FAFAFA] px-4 py-3 text-[15px] leading-[1.45] text-[#0A0A0A] focus:border-[#B08A44] focus:outline-none focus:ring-1 focus:ring-[#B08A44]/30"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-2 w-full rounded-[14px] border border-[#EDECE8] bg-[#FAFAFA] px-4 py-3 text-[15px] text-[#0A0A0A] focus:border-[#B08A44] focus:outline-none focus:ring-1 focus:ring-[#B08A44]/30"
        />
      )}
    </label>
  );
}
