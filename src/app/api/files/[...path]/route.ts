import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

type Params = { path: string[] };

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  const { path: parts } = await context.params;
  const safe = parts.map((part) => part.replace(/[^a-zA-Z0-9._-]/g, ""));
  const filePath = path.join(process.cwd(), ".data", "uploads", ...safe);
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".svg"
            ? "image/svg+xml"
            : ext === ".pdf"
              ? "application/pdf"
              : "application/octet-stream";
    return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": type } });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
