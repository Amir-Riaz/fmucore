// ============================================================
// FMUCORE — Cloudinary Upload
// Unsigned client-side upload. Create an unsigned upload preset
// in Cloudinary console: Settings → Upload → Upload presets.
// ============================================================


const CLOUDINARY_CLOUD_NAME = "mdgerdzi";        // ← replace
const CLOUDINARY_UPLOAD_PRESET = "w87awyq9"; // ← replace

/**
 * Uploads a file to Cloudinary and returns the response
 * (secure_url, public_id, original_filename, bytes, format, etc).
 */

export async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  // keeps non-image files (pdf/doc) uploading correctly
  formData.append("resource_type", "auto");

  console.log("[cloudinary] uploading:", file.name, file.size, "bytes");

  const res = await fetch(url, { method: "POST", body: formData });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("[cloudinary] upload failed:", res.status, errBody);
    throw new Error("Cloudinary upload failed");
  }

  const data = await res.json();
  console.log("[cloudinary] upload success:", data.secure_url);
  return data;
}