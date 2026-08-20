import { put } from "@vercel/blob";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

function extFromName(name: string, mime: string) {
  const fromName = path.extname(name).toLowerCase();
  if (fromName) return fromName;
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("svg")) return ".svg";
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("word")) return ".docx";
  if (mime.includes("text")) return ".txt";
  return "";
}

export async function storeFile(file: File, folder: string) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = extFromName(file.name, file.type);
  const key = `${folder}/${nanoid(16)}${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, bytes, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type || "application/octet-stream",
    });
    return { url: blob.url, key };
  }

  const destDir = path.join(process.cwd(), ".data", "uploads", folder);
  await mkdir(destDir, { recursive: true });
  const filename = path.basename(key);
  await writeFile(path.join(destDir, filename), bytes);
  return { url: `/api/files/${folder}/${filename}`, key };
}
