/** Anexos da MAG — imagens e documentos, com validação e leitura local. */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"];
export const DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
];

export const ACCEPT_IMAGE = ".jpg,.jpeg,.png,.heic,.heif,.webp,image/*";
export const ACCEPT_DOC = ".pdf,.docx,.xlsx,.csv,.txt,application/pdf,text/csv,text/plain";

const MAX_BYTES = 12 * 1024 * 1024;

export type LocalAttachment = {
  id: string;
  name: string;
  mediaType: string;
  size: number;
  kind: "image" | "doc";
  status: "loading" | "ready" | "error";
  error?: string;
  /** data:<mime>;base64,... para envio à MAG */
  dataUrl?: string;
  /** conteúdo textual extraído localmente (txt/csv) */
  text?: string;
  /** URL local só para miniatura */
  previewUrl?: string;
  file?: File;
};

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function detectKind(file: File): "image" | "doc" | null {
  const ext = extOf(file.name);
  if (file.type.startsWith("image/") || ["jpg", "jpeg", "png", "heic", "heif", "webp"].includes(ext))
    return "image";
  if (DOC_TYPES.includes(file.type) || ["pdf", "docx", "xlsx", "csv", "txt"].includes(ext))
    return "doc";
  return null;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read"));
    r.readAsDataURL(file);
  });
}

/** Lê e valida um arquivo, devolvendo o anexo pronto para envio. */
export async function readAttachment(file: File): Promise<LocalAttachment> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const kind = detectKind(file);
  const base: LocalAttachment = {
    id,
    name: file.name || "arquivo",
    mediaType: file.type || "application/octet-stream",
    size: file.size,
    kind: kind ?? "doc",
    status: "error",
    file,
  };

  if (!kind) {
    return { ...base, error: "Formato não suportado. Use JPG, PNG, HEIC, PDF, DOCX, XLSX, CSV ou TXT." };
  }
  if (file.size > MAX_BYTES) {
    return { ...base, kind, error: "Arquivo muito grande (máx. 12 MB)." };
  }

  const ext = extOf(file.name);
  try {
    if (kind === "doc" && (ext === "txt" || ext === "csv" || file.type.startsWith("text/"))) {
      const text = (await file.text()).slice(0, 20000);
      if (!text.trim()) return { ...base, kind, error: "Não consegui ler esse arquivo." };
      return { ...base, kind, status: "ready", text };
    }
    const dataUrl = await readAsDataUrl(file);
    if (!dataUrl.includes(",")) return { ...base, kind, error: "Não consegui ler esse arquivo." };
    return {
      ...base,
      kind,
      status: "ready",
      dataUrl,
      previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
      mediaType: file.type || (ext === "pdf" ? "application/pdf" : base.mediaType),
    };
  } catch {
    return { ...base, kind, error: "Não consegui ler esse arquivo." };
  }
}

/** Formato serializável enviado ao servidor. */
export type AttachmentPayload = {
  name: string;
  mediaType: string;
  kind: "image" | "doc";
  dataUrl?: string;
  text?: string;
};

export function toPayload(list: LocalAttachment[]): AttachmentPayload[] {
  return list
    .filter((a) => a.status === "ready")
    .slice(0, 5)
    .map((a) => ({
      name: a.name,
      mediaType: a.mediaType,
      kind: a.kind,
      dataUrl: a.dataUrl,
      text: a.text,
    }));
}
