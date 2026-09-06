"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import type { KnowledgeMessages } from "../../lib/i18n/knowledge-messages";

export function FileDropZone({ label, messages, onFiles }: { label: string; messages: KnowledgeMessages; onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  function accept(files: FileList | null) { if (files) onFiles(Array.from(files)); if (input.current) input.current.value = ""; }
  return <div role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") input.current?.click(); }} onDragOver={(event: DragEvent) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event: DragEvent) => { event.preventDefault(); setDragging(false); accept(event.dataTransfer.files); }} className={`cursor-pointer rounded-[10px] border-[1.5px] border-dashed px-5 py-7 text-center transition ${dragging ? "border-[var(--qf-accent)] bg-[var(--qf-accent-soft)]" : "border-[var(--qf-border)] hover:border-[var(--qf-accent)]"}`}>
    <input ref={input} type="file" multiple accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="sr-only" onChange={(event: ChangeEvent<HTMLInputElement>) => accept(event.target.files)} />
    <p className="text-[13px] font-medium text-[var(--qf-text-light)]"><span aria-hidden>⬆</span> {label} · {messages.formats}</p><p className="mt-1 text-[11px] text-[var(--qf-text-light)]">{messages.dropHint}</p>
  </div>;
}
