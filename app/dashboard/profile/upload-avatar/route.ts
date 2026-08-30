import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdminClient, storageBuckets, validateFileUpload } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  try {
    validateFileUpload(file, ["image/jpeg", "image/png", "image/webp"], 2 * 1024 * 1024);

    const supabase = await createSupabaseAdminClient();
    const fileName = `${user.id}-${Date.now()}.${file.name.split(".").pop() ?? "png"}`;
    const { error } = await supabase.storage.from(storageBuckets.userAvatars).upload(fileName, file, {
      upsert: true,
      contentType: file.type
    });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from(storageBuckets.userAvatars).getPublicUrl(fileName);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        avatarUrl: data.publicUrl
      }
    });

    return NextResponse.json({ success: true, avatarUrl: data.publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
