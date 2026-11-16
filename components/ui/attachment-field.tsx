"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useI18n } from "../i18n/i18n-provider";

export type AttachmentItem = {
  id?: string;
  name: string;
  type: "photo" | "video" | "voice" | "file";
  url?: string;
};

type Copy = {
  label: string;
  drop: string;
  hint: string;
  hintDocuments: string;
  choose: string;
  camera: string;
  remove: string;
  replace: string;
  processing: string;
  invalid: string;
  invalidDocuments: string;
  limit: string;
};

const COPY: Record<"en" | "de" | "it", Copy> = {
  en: {
    label: "Attachments",
    drop: "Paste a screenshot, drop files here, or choose files",
    hint: "Ctrl+V / Cmd+V supported · large photos are compressed automatically",
    hintDocuments: "PDF, Word, images, ICO, or ZIP · large photos are compressed automatically",
    choose: "Choose files",
    camera: "Take photo",
    remove: "Delete",
    replace: "Replace",
    processing: "Preparing images…",
    invalid: "Only supported image/media files can be attached.",
    invalidDocuments: "Only PDF, Word, images, ICO, and ZIP files can be attached.",
    limit: "A maximum of {count} attachments is allowed.",
  },
  de: {
    label: "Anhänge",
    drop: "Screenshot einfügen, Dateien hier ablegen oder auswählen",
    hint: "Strg+V / Cmd+V möglich · große Fotos werden automatisch komprimiert",
    hintDocuments: "PDF, Word, Bilder, ICO oder ZIP · große Fotos werden automatisch komprimiert",
    choose: "Dateien auswählen",
    camera: "Foto aufnehmen",
    remove: "Löschen",
    replace: "Ersetzen",
    processing: "Bilder werden vorbereitet…",
    invalid: "Nur unterstützte Bild-/Mediendateien können angehängt werden.",
    invalidDocuments: "Nur PDF-, Word-, Bild-, ICO- und ZIP-Dateien können angehängt werden.",
    limit: "Maximal {count} Anhänge sind erlaubt.",
  },
  it: {
    label: "Allegati",
    drop: "Incolla uno screenshot, trascina i file qui o selezionali",
    hint: "Ctrl+V / Cmd+V supportato · le foto grandi vengono compresse automaticamente",
    hintDocuments: "PDF, Word, immagini, ICO o ZIP · le foto grandi vengono compresse automaticamente",
    choose: "Scegli file",
    camera: "Scatta foto",
    remove: "Elimina",
    replace: "Sostituisci",
    processing: "Preparazione immagini…",
    invalid: "È possibile allegare solo file immagine/multimediali supportati.",
    invalidDocuments: "È possibile allegare solo file PDF, Word, immagini, ICO e ZIP.",
    limit: "Sono consentiti al massimo {count} allegati.",
  },
};

const COMPRESS_AFTER_BYTES = 1024 * 1024;
const MAX_IMAGE_EDGE = 1920;

function copyFor(locale: string) {
  return COPY[locale === "de" || locale === "it" ? locale : "en"];
}

function replacementName(name: string) {
  const stem = name.replace(/\.[^.]+$/, "") || "photo";
  return `${stem}.webp`;
}

const DOCUMENT_NAME = /\.(pdf|docx?|ico|zip)$/i;
const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function isIcoFile(file: File) {
  return /\.ico$/i.test(file.name) || file.type === "image/x-icon" || file.type === "image/vnd.microsoft.icon";
}

function isDocumentFile(file: File) {
  return DOCUMENT_TYPES.has(file.type) || DOCUMENT_NAME.test(file.name);
}

function isRasterImage(file: File) {
  return file.type.startsWith("image/") && !isIcoFile(file);
}

const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.ico,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/x-zip-compressed,image/x-icon,image/vnd.microsoft.icon";

function acceptList(allowMedia: boolean, allowDocuments: boolean) {
  return [allowMedia ? "image/*,video/*,audio/*" : "image/*", allowDocuments ? DOCUMENT_ACCEPT : ""].filter(Boolean).join(",");
}

export async function compressAttachmentImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || isIcoFile(file) || file.type === "image/gif" || file.type === "image/svg+xml" || file.size <= COMPRESS_AFTER_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) { bitmap.close(); return file; }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], replacementName(file.name), { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

function PhotoThumb({ url, width, height, radius }: { url: string; width: number | string; height: number | string; radius: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span aria-hidden style={{ width, height, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto", borderRadius: radius, background: "var(--surface-2, #f3f4f6)", fontSize: 16 }}>📎</span>;
  return <img src={url} alt="" draggable={false} style={{ display: "block", width, height, maxWidth: "100%", objectFit: "cover", flex: "0 0 auto", borderRadius: radius, background: "var(--surface-2, #f3f4f6)", boxShadow: "inset 0 0 0 1px var(--border)" }} onError={() => setFailed(true)} />;
}

function LocalThumbnail({ file }: { file: File }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  if (!file.type.startsWith("image/") || isIcoFile(file)) return <span aria-hidden style={{ fontSize: 22 }}>{file.type.startsWith("video/") ? "🎥" : file.type.startsWith("audio/") ? "🎤" : "📎"}</span>;
  return <PhotoThumb url={url} width={52} height={52} radius={8} />;
}

function StoredThumbnail({ item }: { item: AttachmentItem }) {
  if (item.type === "photo" && item.url) return <PhotoThumb url={item.url} width={52} height={52} radius={8} />;
  return <span aria-hidden style={{ fontSize: 22 }}>{item.type === "video" ? "🎥" : item.type === "voice" ? "🎤" : "📎"}</span>;
}

export function AttachmentField({
  existing,
  files,
  onExistingChange,
  onFilesChange,
  onProcessingChange,
  allowMedia = false,
  allowDocuments = false,
  maxFiles = 10,
  label,
}: {
  existing: AttachmentItem[];
  files: File[];
  onExistingChange: (items: AttachmentItem[]) => void;
  onFilesChange: (files: File[]) => void;
  onProcessingChange?: (processing: boolean) => void;
  allowMedia?: boolean;
  allowDocuments?: boolean;
  maxFiles?: number;
  label?: string;
}) {
  const { locale } = useI18n();
  const copy = copyFor(locale);
  const pickerRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<{ kind: "existing" | "file"; index: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const accepts = useCallback((file: File) => isRasterImage(file) || (allowMedia && (file.type.startsWith("video/") || file.type.startsWith("audio/"))) || (allowDocuments && isDocumentFile(file)), [allowDocuments, allowMedia]);

  const prepare = useCallback(async (incoming: File[], target?: { kind: "existing" | "file"; index: number } | null) => {
    const supported = incoming.filter(accepts);
    if (!supported.length) { setError(allowDocuments ? copy.invalidDocuments : copy.invalid); return; }
    const replacing = Boolean(target);
    const available = maxFiles - existing.length - files.length + (replacing ? 1 : 0);
    if (available <= 0) { setError(copy.limit.replace("{count}", String(maxFiles))); return; }
    if (supported.length > available) setError(copy.limit.replace("{count}", String(maxFiles)));
    else setError("");
    setProcessing(true);
    onProcessingChange?.(true);
    try {
      const prepared: File[] = [];
      for (const file of supported.slice(0, available)) prepared.push(await compressAttachmentImage(file));
      if (target?.kind === "existing") {
        onExistingChange(existing.filter((_, index) => index !== target.index));
        onFilesChange([...files, ...prepared].slice(0, maxFiles));
      } else if (target?.kind === "file") {
        const next = [...files];
        next.splice(target.index, 1, prepared[0]);
        onFilesChange(next);
      } else {
        onFilesChange([...files, ...prepared].slice(0, maxFiles - existing.length));
      }
    } finally {
      setProcessing(false);
      onProcessingChange?.(false);
    }
  }, [accepts, allowDocuments, copy.invalid, copy.invalidDocuments, copy.limit, existing, files, maxFiles, onExistingChange, onFilesChange, onProcessingChange]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const pasted = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
      if (!pasted.length) return;
      event.preventDefault();
      void prepare(pasted);
    };
    document.addEventListener("paste", onPaste, true);
    return () => document.removeEventListener("paste", onPaste, true);
  }, [prepare]);

  function select(input: HTMLInputElement, target?: { kind: "existing" | "file"; index: number } | null) {
    if (!input.files?.length) return;
    void prepare([...input.files], target);
    input.value = "";
  }

  function replace(target: { kind: "existing" | "file"; index: number }) {
    replaceTarget.current = target;
    replaceRef.current?.click();
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void prepare([...event.dataTransfer.files]);
  }

  return <div>
    <label className="field-lbl">{label || copy.label}</label>
    <div
      className="dropzone"
      style={{ marginBottom: 0, borderColor: dragging ? "var(--accent)" : undefined, background: dragging ? "var(--accent-soft)" : undefined }}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={drop}
    >
      <div style={{ fontWeight: 650 }}>📎 {copy.drop}</div>
      <div style={{ fontSize: 11, marginTop: 4 }}>{processing ? copy.processing : allowDocuments ? copy.hintDocuments : copy.hint}</div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" className="btn btn-ghost" disabled={processing} onClick={() => pickerRef.current?.click()}>{copy.choose}</button>
        <button type="button" className="btn btn-ghost" disabled={processing} onClick={() => cameraRef.current?.click()}>📷 {copy.camera}</button>
      </div>
    </div>
    <input ref={pickerRef} type="file" hidden multiple accept={acceptList(allowMedia, allowDocuments)} onChange={(event) => select(event.currentTarget)} />
    <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={(event) => select(event.currentTarget)} />
    <input ref={replaceRef} type="file" hidden accept={acceptList(allowMedia, allowDocuments)} onChange={(event) => { select(event.currentTarget, replaceTarget.current); replaceTarget.current = null; }} />
    {error ? <p role="alert" className="job-apply-error" style={{ marginTop: 8 }}>{error}</p> : null}
    {existing.length || files.length ? <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
      {existing.map((item, index) => <div key={item.id ?? `${item.name}-${index}`} className="doc-row" style={{ gap: 10 }}>
        <StoredThumbnail item={item} />
        <div className="doc-name">{item.name}</div>
        <button type="button" className="btn btn-ghost" style={{ padding: "6px 9px" }} onClick={() => replace({ kind: "existing", index })}>{copy.replace}</button>
        <button type="button" className="icon-btn danger" aria-label={`${copy.remove}: ${item.name}`} title={copy.remove} onClick={() => onExistingChange(existing.filter((_, itemIndex) => itemIndex !== index))}>🗑️</button>
      </div>)}
      {files.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="doc-row" style={{ gap: 10 }}>
        <LocalThumbnail file={file} />
        <div className="doc-name">{file.name}</div>
        <button type="button" className="btn btn-ghost" style={{ padding: "6px 9px" }} onClick={() => replace({ kind: "file", index })}>{copy.replace}</button>
        <button type="button" className="icon-btn danger" aria-label={`${copy.remove}: ${file.name}`} title={copy.remove} onClick={() => onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))}>🗑️</button>
      </div>)}
    </div> : null}
  </div>;
}

export function AttachmentIndicator({ attachments }: { attachments?: AttachmentItem[] }) {
  if (!attachments?.length) return null;
  const photo = attachments.find((item) => item.type === "photo" && item.url);
  const label = `${attachments.length} attachment(s)`;
  if (photo?.url) return <span title={label} aria-label={label} style={{ display: "inline-flex", flex: "0 0 auto" }}><PhotoThumb url={photo.url} width={30} height={30} radius={7} /></span>;
  return <span title={label} aria-label={label} style={{ whiteSpace: "nowrap" }}>📎 {attachments.length}</span>;
}

export function AttachmentGallery({ attachments }: { attachments?: AttachmentItem[] }) {
  if (!attachments?.length) return null;
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginTop: 14 }}>
    {attachments.map((item, index) => <a key={item.id ?? `${item.name}-${index}`} href={item.url || "#"} target="_blank" rel="noreferrer" className="doc-row" style={{ minHeight: 82, padding: 8, textDecoration: "none", flexDirection: "column", alignItems: "stretch" }}>
      {item.type === "photo" && item.url ? <PhotoThumb url={item.url} width="100%" height={100} radius={7} /> : <span aria-hidden style={{ fontSize: 28, textAlign: "center" }}>{item.type === "video" ? "🎥" : item.type === "voice" ? "🎤" : "📎"}</span>}
      <span className="doc-name" style={{ fontSize: 11.5 }}>{item.name}</span>
    </a>)}
  </div>;
}
