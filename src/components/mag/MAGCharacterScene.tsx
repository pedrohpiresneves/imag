import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF, Center } from "@react-three/drei";
import * as THREE from "three";
import {
  MAG_MODEL_URL,
  MAG_POSES,
  type MAGFraming,
  type MAGState,
} from "./mag-character-state";

/**
 * Modelo GLB do MAG com transição suave entre estados.
 * Se o arquivo trouxer clipes de animação, eles são usados; caso contrário,
 * a postura é aplicada proceduralmente (flutuação, inclinação, olhar, piscar).
 */
function MAGModel({
  state,
  framing,
}: {
  state: MAGState;
  framing: MAGFraming;
}) {
  const group = useRef<THREE.Group>(null);
  const gltf = useGLTF(MAG_MODEL_URL);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const { actions, mixer } = useAnimations(gltf.animations, group);

  const pose = MAG_POSES[state] ?? MAG_POSES.idle;
  const current = useRef({ tilt: 0, yaw: 0, lift: 0, scale: 1 });
  const blinkAt = useRef(0);

  // troca de clipe com crossfade
  useEffect(() => {
    if (!actions) return;
    const name = pose.clips.find((c) => actions[c]);
    if (!name) return;
    const next = actions[name]!;
    next.reset().fadeIn(0.35).play();
    return () => {
      next.fadeOut(0.35);
    };
  }, [actions, pose.clips]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    mixer?.update?.(0); // clipes já avançam via useAnimations
    const t = performance.now() / 1000;
    const c = current.current;
    const k = 1 - Math.pow(0.001, delta); // easing exponencial estável

    c.tilt += (pose.tilt - c.tilt) * k;
    c.yaw += (pose.yaw - c.yaw) * k;
    c.lift += (pose.lift - c.lift) * k;
    c.scale += (pose.scale - c.scale) * k;

    g.rotation.x = c.tilt;
    g.rotation.z = c.tilt * 0.25;
    g.rotation.y = c.yaw + Math.sin(t * 0.4) * 0.05;
    g.position.y = c.lift + Math.sin(t * pose.speed) * pose.float;

    // piscar: leve compressão vertical, curta e natural
    let blinkScale = 1;
    if (pose.blink) {
      if (t * 1000 > blinkAt.current) {
        blinkAt.current = t * 1000 + pose.blink + Math.random() * pose.blink * 0.6;
      }
      const since = blinkAt.current - t * 1000;
      if (since < 130) blinkScale = 0.96;
    }
    g.scale.setScalar(c.scale);
    g.scale.y = c.scale * blinkScale;
  });

  return (
    <group ref={group} position={[0, framing === "head" ? -0.1 : 0, 0]}>
      <Center disableY={false}>
        <primitive object={scene} />
      </Center>
    </group>
  );
}

export default function MAGCharacterScene({
  state = "idle",
  framing = "full",
  active = true,
}: {
  state?: MAGState;
  framing?: MAGFraming;
  active?: boolean;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={active ? "always" : "never"}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ background: "transparent", width: "100%", height: "100%" }}
      camera={{
        position: framing === "head" ? [0, 0.35, 2.1] : [0, 0.2, 3.4],
        fov: 28,
      }}
    >
      {/* iluminação suave, sem fundo próprio */}
      <ambientLight intensity={1.1} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.5} />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.5} color="#BFD0FF" />
      <Suspense fallback={null}>
        <MAGModel state={state} framing={framing} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload?.(MAG_MODEL_URL);
