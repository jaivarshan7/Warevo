"use client";

import { useState } from "react";
import { Upload, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploadField } from "@/components/file-upload-field";

export function AvatarUploadForm({ currentAvatarUrl }: { currentAvatarUrl?: string | null }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    if (!file) {
      setError("Please choose an image before uploading.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await fetch("/dashboard/profile/upload-avatar", {
        method: "POST",
        body: formData
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Avatar upload failed.");
      }

      setSuccess("Avatar updated successfully.");
      window.location.reload();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <FileUploadField
        label="Profile photo"
        accept="image/jpeg,image/png,image/webp"
        maxSizeMb={2}
        initialPreviewUrl={currentAvatarUrl}
        helperText="JPG, PNG, or WEBP up to 2 MB"
        buttonLabel="Choose image"
        onFileSelect={(selectedFile) => setFile(selectedFile)}
      />

      {error && (
        <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <X className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <Check className="h-3.5 w-3.5" /> {success}
        </div>
      )}

      <Button type="button" onClick={handleSubmit} disabled={isUploading || !file} className="w-full justify-center">
        {isUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4" /> Upload avatar</>}
      </Button>
    </div>
  );
}
