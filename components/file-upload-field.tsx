"use client";

import { UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";

export type FileUploadFieldProps = {
  label: string;
  accept?: string;
  maxSizeMb?: number;
  initialPreviewUrl?: string | null;
  helperText?: string;
  buttonLabel?: string;
  onFileSelect?: (file: File) => void;
};

export function FileUploadField({
  label,
  accept = "image/*",
  maxSizeMb = 2,
  initialPreviewUrl,
  helperText,
  buttonLabel = "Choose file",
  onFileSelect
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreviewUrl ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!accept.split(",").some((type) => {
      if (type === "image/*") return file.type.startsWith("image/");
      return file.type === type || file.name.toLowerCase().endsWith(type.replace(".", ""));
    })) {
      setError(`Unsupported file type. Allowed: ${accept}`);
      return;
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File is too large. Maximum allowed size is ${maxSizeMb} MB.`);
      return;
    }

    setError(null);
    setFileName(file.name);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    onFileSelect?.(file);
  };

  const removePreview = () => {
    setPreviewUrl(initialPreviewUrl ?? null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />

        <div className="flex flex-col items-center justify-center gap-3 text-center">
          {previewUrl ? (
            <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
              <img src={previewUrl} alt="Preview" className="h-28 w-28 rounded-lg object-cover" />
              <button
                type="button"
                onClick={removePreview}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white"
                aria-label="Remove preview"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary shadow-sm">
              <UploadCloud className="h-7 w-7" />
            </div>
          )}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            {buttonLabel}
          </button>

          {fileName && <div className="text-xs text-slate-500">Selected: {fileName}</div>}
          {helperText && <div className="text-xs text-slate-500">{helperText}</div>}
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
      </div>
    </div>
  );
}
