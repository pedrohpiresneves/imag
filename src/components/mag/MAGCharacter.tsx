import { lazy, Suspense, useEffect, useRef, useState } from "react";
import magHeadOfficial from "@/assets/mag-head-official.png.asset.json";
import magBodyOfficial from "@/assets/mag-body-official.png.asset.json";
import {
  MAG_MODEL_URL,
  type MAGFraming,
  type MAGState,
} from "./mag-character-state";

const MAGCharacterScene = lazy(() => import("./MAGCharacterScene"));


/** Verifica uma única vez se o modelo 3D real já foi publicado. */
let modelCheck: Promise<boolean> | null = null;
function checkModel() {
  if (!modelCheck) {
    modelCheck = fetch(MAG_MODEL_URL, { method: "HEAD" })
      .then((r) => r.ok && (r.headers.get("content-type") ?? "").indexOf("html") === -1)
      .catch(() => false);
  }
  return modelCheck;
}

/**
 * MAGCharacter — personagem 3D da iMAG.
 *
 * Renderiza o modelo .glb/.gltf com fundo transparente, diretamente sobre a
 * interface (sem moldura, sem thumbnail, sem PNG). Enquanto o modelo real não
 * existir, ocupa o mesmo espaço de forma transparente, mantendo posição,
 * dimensões e a API de estados intactas.
 */
export function MAGCharacter({
  state = "idle",
  size = 96,
  width,
  height,
  framing = "full",
  className = "",
  shadow = false,
}: {
  state?: MAGState;
  size?: number;
  width?: number;
  height?: number;
  framing?: MAGFraming;
  className?: string;
  /** sombra de contato extremamente sutil */
  shadow?: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  const [hasModel, setHasModel] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(false);

  const w = width ?? size;
  const h = height ?? size;

  // só carrega quando entra na viewport (performance mobile)
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      setReady(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = !!entry?.isIntersecting;
        setVisible(v);
        if (v) setReady(true);
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    checkModel().then((ok) => alive && setHasModel(ok));
    return () => {
      alive = false;
    };
  }, [ready]);

  return (
    <span
      ref={host}
      className={`relative inline-block shrink-0 align-middle ${className}`}
      style={{ width: w, height: h, background: "transparent" }}
      aria-hidden
      data-mag-state={state}
    >
      {shadow && (
        <span
          className="pointer-events-none absolute left-1/2 bottom-[4%] -translate-x-1/2 rounded-[50%]"
          style={{
            width: w * 0.5,
            height: Math.max(3, h * 0.05),
            background: "rgba(15,23,42,0.16)",
            filter: "blur(5px)",
          }}
        />
      )}
      {ready && hasModel && (
        <Suspense fallback={null}>
          <MAGCharacterScene state={state} framing={framing} active={visible} />
        </Suspense>
      )}
      {/* Identidade oficial da MAG: cabeça frontal nos elementos de interface e
          corpo inteiro (pose de boas-vindas) nos momentos de destaque. */}
      {ready && hasModel === false && (
        <img
          src={framing === "head" ? magHeadOfficial.url : magBodyOfficial.url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
          style={{
            animation: `mag-float ${state === "walking" ? "0.9s" : "4.2s"} ease-in-out infinite`,
          }}
        />
      )}

    </span>
  );
}

export { type MAGState, type MAGFraming } from "./mag-character-state";
