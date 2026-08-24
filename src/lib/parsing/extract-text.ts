import mammoth from "mammoth";

const MIN_USEFUL_CHARS = 80;

function normalizeExtracted(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfWithUnpdf(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  const joined = Array.isArray(text) ? text.join("\n\n") : String(text || "");
  return normalizeExtracted(joined);
}

/** OpenRouter file-parser can OCR scanned PDFs when local text layer is empty. */
async function extractPdfWithOpenRouter(buffer: Buffer, filename: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return "";

  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4";
  const dataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;
  const engines = ["pdf-text", "mistral-ocr"] as const;

  for (const engine of engines) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://siteform-omega.vercel.app",
          "X-Title": process.env.NEXT_PUBLIC_APP_NAME || "Siteform",
        },
        body: JSON.stringify({
          model,
          max_tokens: 16000,
          plugins: [{ id: "file-parser", pdf: { engine } }],
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract ALL readable content from this PDF as clean Markdown.

Rules:
- Preserve headings, bullet lists, numbered lists, tables as markdown tables when possible
- Keep every service/product/menu item and price
- Keep contact details, hours, addresses, emails, phones, WhatsApp, social links
- Keep doctor/team names, clinic names, FAQs, testimonials if present
- Output ONLY markdown — no preamble, no code fences`,
                },
                {
                  type: "file",
                  file: {
                    filename: filename || "document.pdf",
                    file_data: dataUrl,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) continue;
      const json = (await res.json()) as {
        choices?: { message?: { content?: string | { type: string; text?: string }[] } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      let text = "";
      if (typeof content === "string") text = content;
      else if (Array.isArray(content)) {
        text = content
          .map((block) => (typeof block === "string" ? block : block.text || ""))
          .join("\n");
      }
      text = normalizeExtracted(text.replace(/^```markdown\s*/i, "").replace(/```$/i, ""));
      if (text.length >= MIN_USEFUL_CHARS) return text;
    } catch {
      /* try next engine */
    }
  }

  return "";
}

export async function extractDocumentText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "";
  const name = file.name.toLowerCase();

  try {
    if (mime.includes("pdf") || name.endsWith(".pdf")) {
      let text = await extractPdfWithUnpdf(buffer);
      if (text.length < MIN_USEFUL_CHARS) {
        const viaAi = await extractPdfWithOpenRouter(buffer, file.name);
        if (viaAi.length >= MIN_USEFUL_CHARS) text = viaAi;
      }
      if (!text || text.length < MIN_USEFUL_CHARS) {
        throw new Error(
          "This PDF has almost no readable text (it may be a scan). We tried OCR via OpenRouter — paste the text, or upload a text-based PDF.",
        );
      }
      return text;
    }

    if (
      mime.includes("wordprocessingml") ||
      mime.includes("msword") ||
      name.endsWith(".docx") ||
      name.endsWith(".doc")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      const text = normalizeExtracted(result.value || "");
      if (text.length < MIN_USEFUL_CHARS) throw new Error("empty");
      return text;
    }

    const text = normalizeExtracted(buffer.toString("utf8"));
    if (text.length < MIN_USEFUL_CHARS) throw new Error("empty");
    return text;
  } catch (error) {
    if (error instanceof Error && error.message.includes("PDF")) throw error;
    throw new Error(
      "We couldn't read that file. Paste the document text, or upload a .txt / text-based PDF.",
    );
  }
}

export { MIN_USEFUL_CHARS, normalizeExtracted };
