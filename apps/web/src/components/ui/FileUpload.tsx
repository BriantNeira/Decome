"use client";

import { DragEvent, InputHTMLAttributes, useRef, useState } from "react";

interface FileUploadProps {
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  onFile: (file: File) => void;
}

export function FileUpload({ accept, maxSizeMB = 2, label = "Upload file", onFile }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setError(null);
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File exceeds ${maxSizeMB}MB limit.`);
      return;
    }
    onFile(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors
        ${dragging ? "border-action bg-action/5" : "border-border hover:border-action/50"}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <div className="flex flex-col items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-text-secondary">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="text-sm text-text-secondary">
          <span className="text-action font-medium">{label}</span> or drag and drop
        </p>
        {accept && <p className="text-xs text-text-secondary">Accepted: {accept}</p>}
        <p className="text-xs text-text-secondary">Max {maxSizeMB}MB</p>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
