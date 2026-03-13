// @ts-ignore - pdf-parse has no default export in types but works with esModuleInterop
import pdf from "pdf-parse";
import mammoth from "mammoth";

export async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === "application/pdf" || mimeType.includes("pdf")) {
      const data = await pdf(buffer);
      return data.text;
    } 
    
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
      mimeType.includes("officedocument.wordprocessingml.document") ||
      mimeType.includes("docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    // Default: try to treat as text if it's not a binary we know how to handle
    if (mimeType.startsWith("text/")) {
      return buffer.toString("utf-8");
    }

    return "";
  } catch (error) {
    console.error("Error extracting text from buffer:", error);
    return "";
  }
}
