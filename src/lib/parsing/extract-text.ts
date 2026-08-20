import mammoth from "mammoth";

export async function extractDocumentText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "";
  const name = file.name.toLowerCase();

  try {
    if (mime.includes("pdf") || name.endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      const joined = Array.isArray(text) ? text.join("\n") : text;
      if (!joined.trim()) {
        throw new Error("empty");
      }
      return joined;
    }

    if (
      mime.includes("wordprocessingml") ||
      mime.includes("msword") ||
      name.endsWith(".docx") ||
      name.endsWith(".doc")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value.trim()) throw new Error("empty");
      return result.value;
    }

    return buffer.toString("utf8");
  } catch {
    throw new Error(
      "We couldn't read that file. Try uploading as a .txt, pasting the text, or answer the quick questions instead.",
    );
  }
}
