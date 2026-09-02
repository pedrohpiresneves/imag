/**
 * Estados do personagem MAG (personagem 3D real, nunca imagem estática).
 * Cada estado define a postura procedural aplicada ao modelo GLB e o nome
 * da animação preferida caso o arquivo .glb já traga clipes prontos.
 */
export type MAGState =
  | "idle"
  | "happy"
  | "thinking"
  | "sad"
  | "attention"
  | "celebrate"
  | "walking";

/** URL do modelo 3D. Basta publicar o arquivo neste caminho para ativá-lo. */
export const MAG_MODEL_URL = "/models/mag.glb";

export type MAGPose = {
  /** nomes de clipe aceitos no GLB, em ordem de preferência */
  clips: string[];
  /** amplitude da flutuação vertical (unidades do mundo) */
  float: number;
  /** velocidade da flutuação */
  speed: number;
  /** inclinação da cabeça/corpo em radianos */
  tilt: number;
  /** rotação lateral (olhar) em radianos */
  yaw: number;
  /** deslocamento vertical base */
  lift: number;
  /** escala relativa */
  scale: number;
  /** intervalo médio entre piscadas (ms); 0 desativa */
  blink: number;
};

export const MAG_POSES: Record<MAGState, MAGPose> = {
  idle: { clips: ["idle", "Idle"], float: 0.035, speed: 1.1, tilt: 0, yaw: 0, lift: 0, scale: 1, blink: 4600 },
  happy: { clips: ["happy", "Happy"], float: 0.055, speed: 2.2, tilt: 0.04, yaw: 0, lift: 0.05, scale: 1.03, blink: 3200 },
  thinking: { clips: ["thinking", "Thinking"], float: 0.02, speed: 1.5, tilt: -0.16, yaw: 0.22, lift: 0, scale: 1, blink: 2400 },
  sad: { clips: ["sad", "Sad"], float: 0.012, speed: 0.7, tilt: 0.2, yaw: 0, lift: -0.05, scale: 0.98, blink: 5200 },
  attention: { clips: ["attention", "Attention"], float: 0.03, speed: 1.8, tilt: -0.05, yaw: 0, lift: 0.03, scale: 1.06, blink: 2800 },
  celebrate: { clips: ["celebrate", "Celebrate"], float: 0.09, speed: 3, tilt: 0, yaw: 0, lift: 0.07, scale: 1.05, blink: 2600 },
  walking: { clips: ["walk", "Walking", "walking"], float: 0.045, speed: 4.2, tilt: 0.05, yaw: 0, lift: 0, scale: 1, blink: 3600 },
};

/** Enquadramento: personagem inteiro ou apenas cabeça/rosto. */
export type MAGFraming = "full" | "head";
