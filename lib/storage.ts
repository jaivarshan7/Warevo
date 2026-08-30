import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const storageBuckets = {
  invoices: "invoices",
  ewayBills: "eway-bills",
  productImages: "product-images",
  userAvatars: "user-avatars",
  warehouseDocuments: "warehouse-documents"
} as const;

export async function createSupabaseAdminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function createSupabaseBrowserClient() {
  const { createBrowserClient } = await import("@supabase/ssr");
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  );
}

export async function createSupabaseStorageClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        }
      }
    }
  );
}

export function getAvatarUrl(avatarUrl?: string | null) {
  return avatarUrl || null;
}

export function buildStoragePath(bucket: keyof typeof storageBuckets, path: string) {
  return `${bucket}/${path}`.replace(/\\/g, "/");
}

export const allowedUploadTypes = {
  image: ["image/jpeg", "image/png", "image/webp"],
  invoice: ["application/pdf"],
  document: ["application/pdf", "image/jpeg", "image/png", "image/webp"]
} as const;

export function validateFileUpload(file: File, allowedTypes: readonly string[], maxSizeBytes = 5 * 1024 * 1024) {
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Unsupported file type. Please upload a valid format.");
  }

  if (file.size > maxSizeBytes) {
    throw new Error(`File is too large. Maximum size is ${Math.round(maxSizeBytes / (1024 * 1024))} MB.`);
  }

  return true;
}
