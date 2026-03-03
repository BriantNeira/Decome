"use client";

import { useState, useRef, DragEvent } from "react";
import { useToast } from "@/components/ui/Toast";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import api, { parseApiError } from "@/lib/api";
import { ImportResponse, ImportRowResult } from "@/types/ai";

const ENTITY_TYPES = [
  { value: "accounts", label: "Accounts" },
  { value: "programs", label: "Programs" },
  { value: "contacts", label: "Contacts" },
  { value: "assignments", label: "Assignments" },
  { value: "reminders", label: "Reminders" },
] as const;

type EntityType = (typeof ENTITY_TYPES)[number]["value"];

/** Column configs per entity type for preview table */
const PREVIEW_COLUMNS: Record<EntityType, { key: string; label: string }[]> = {
  accounts: [
    { key: "entity_name", label: "Name" },
    { key: "account", label: "Code" },
  ],
  programs: [
    { key: "entity_name", label: "Name" },
    { key: "account", label: "Account" },
  ],
  contacts: [
    { key: "entity_name", label: "Name" },
    { key: "account", label: "Account" },
  ],
  assignments: [
    { key: "account", label: "Account" },
    { key: "program", label: "Program" },
    { key: "entity_name", label: "BDM" },
  ],
  reminders: [
    { key: "account", label: "Account" },
    { key: "program", label: "Program" },
    { key: "title", label: "Title" },
    { key: "due_date", label: "Due Date" },
  ],
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function BulkImportContent() {
  const { showToast, ToastComponent } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [entityType, setEntityType] = useState<EntityType>("accounts");
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportResponse | null>(null);

  // ── File handling ──────────────────────────────────────────────────────
  function validateAndSetFile(f: File) {
    if (!f.name.endsWith(".xlsx")) {
      showToast("Only .xlsx files are accepted", "error");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      showToast("File exceeds 5 MB limit", "error");
      return;
    }
    setFile(f);
    setStep("upload");
    setPreview(null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSetFile(f);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
  }

  // ── Download template ──────────────────────────────────────────────────
  async function handleDownloadTemplate() {
    try {
      const res = await api.get(`/import/${entityType}/template`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${entityType}_template.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to download template"), "error");
    }
  }

  // ── Preview (dry run) ──────────────────────────────────────────────────
  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<ImportResponse>(
        `/import/${entityType}?dry_run=true`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setPreview(res.data);
      setStep("preview");
    } catch (err: any) {
      showToast(parseApiError(err, "Failed to parse file"), "error");
    } finally {
      setLoading(false);
    }
  }

  // ── Import (real run) ──────────────────────────────────────────────────
  async function handleImport() {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post<ImportResponse>(
        `/import/${entityType}?dry_run=false`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setPreview(res.data);
      setStep("done");
    } catch (err: any) {
      showToast(parseApiError(err, "Import failed"), "error");
    } finally {
      setLoading(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────
  function handleReset() {
    setFile(null);
    setPreview(null);
    setStep("upload");
  }

  // ── Row colour helper ──────────────────────────────────────────────────
  function rowBg(row: ImportRowResult) {
    if (row.status === "ok") return "bg-green-50/30";
    if (row.status === "error") return "bg-red-50/50";
    return "bg-gray-50/40"; // skipped
  }

  const columns = PREVIEW_COLUMNS[entityType];
  const skippedCount = preview?.skipped_rows ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Bulk Import</h1>
        <p className="text-sm text-text-secondary mt-1">
          Import records from Excel spreadsheets
        </p>
      </div>

      {/* Entity Type selector */}
      <Card padding="md">
        <label className="block text-sm font-medium text-text-primary mb-2">
          Entity Type
        </label>
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value as EntityType);
            handleReset();
          }}
          className="rounded border border-border bg-surface text-text-primary px-3 py-2 text-sm w-full max-w-xs"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Card>

      {/* Template download + Upload area */}
      {step === "upload" && (
        <Card padding="md">
          <div className="space-y-5">
            {/* Download template */}
            <div>
              <p className="text-sm text-text-secondary mb-3">
                Download the Excel template for <strong className="text-text-primary">{entityType}</strong>, fill it in, then upload it below.
              </p>
              <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
                Download Template
              </Button>
            </div>

            {/* Drag & drop */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
                dragActive
                  ? "border-action bg-action/5"
                  : "border-border"
              }`}
            >
              {file ? (
                <div className="space-y-2">
                  <p className="font-medium text-text-primary text-sm">{file.name}</p>
                  <p className="text-xs text-text-secondary">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <button
                    onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-text-secondary mb-3">
                    Drag & drop your .xlsx file here, or
                  </p>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded bg-action text-white text-sm font-medium hover:bg-action-hover transition-colors">
                    Browse files
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) validateAndSetFile(f);
                      }}
                    />
                  </label>
                  <p className="text-xs text-text-secondary mt-3">
                    .xlsx files only, max 5 MB
                  </p>
                </>
              )}
            </div>

            {/* Preview button */}
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="md"
                loading={loading}
                disabled={!file}
                onClick={handlePreview}
              >
                Preview
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Preview Results */}
      {step === "preview" && preview && (
        <Card padding="md">
          <div className="space-y-4">
            {/* Summary badges */}
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-sm font-medium text-green-700 bg-green-50 px-3 py-1 rounded-full">
                {preview.valid_rows} valid
              </span>
              {preview.error_rows > 0 && (
                <span className="text-sm font-medium text-red-700 bg-red-50 px-3 py-1 rounded-full">
                  {preview.error_rows} error{preview.error_rows !== 1 ? "s" : ""}
                </span>
              )}
              {skippedCount > 0 && (
                <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  {skippedCount} skipped
                </span>
              )}
              <span className="text-sm text-text-secondary ml-auto">
                {preview.total_rows} total row{preview.total_rows !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Results table */}
            <div className="overflow-x-auto border border-border rounded-lg max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-surface-hover border-b border-border text-left">
                    <th className="px-3 py-2 font-semibold text-text-secondary">Row</th>
                    {columns.map((col) => (
                      <th key={col.key} className="px-3 py-2 font-semibold text-text-secondary">
                        {col.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold text-text-secondary">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr
                      key={row.row_num}
                      className={`border-b border-border last:border-0 ${rowBg(row)}`}
                    >
                      <td className="px-3 py-2 text-text-secondary">{row.row_num}</td>
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className="px-3 py-2 text-text-primary max-w-[150px] truncate"
                        >
                          {(row as any)[col.key] ?? "—"}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        {row.status === "ok" ? (
                          <span className="text-green-700 font-medium">OK</span>
                        ) : row.status === "error" ? (
                          <span className="text-red-600" title={row.error_msg ?? ""}>
                            {row.error_msg || "Error"}
                          </span>
                        ) : (
                          <span className="text-gray-500">Skipped</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={loading}
                disabled={preview.valid_rows === 0}
                onClick={handleImport}
              >
                Import {preview.valid_rows} Record{preview.valid_rows !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Done */}
      {step === "done" && preview && (
        <Card padding="md">
          <div className="text-center py-8 space-y-4">
            <div className="text-5xl text-green-600">&#10003;</div>
            <p className="font-semibold text-text-primary text-lg">Import Complete!</p>
            <div className="space-y-1">
              <p className="text-sm text-green-700">
                {preview.created} record{preview.created !== 1 ? "s" : ""} created successfully
              </p>
              {preview.error_rows > 0 && (
                <p className="text-sm text-red-600">
                  {preview.error_rows} row{preview.error_rows !== 1 ? "s" : ""} had errors
                </p>
              )}
              {skippedCount > 0 && (
                <p className="text-sm text-text-secondary">
                  {skippedCount} row{skippedCount !== 1 ? "s" : ""} skipped
                </p>
              )}
            </div>
            <Button variant="primary" size="sm" onClick={handleReset}>
              Import More
            </Button>
          </div>
        </Card>
      )}

      <ToastComponent />
    </div>
  );
}

export default function BulkImportPage() {
  return (
    <RoleGuard
      allowedRoles={["admin"]}
      fallback={<p className="text-red-600 p-8">Access denied</p>}
    >
      <BulkImportContent />
    </RoleGuard>
  );
}
