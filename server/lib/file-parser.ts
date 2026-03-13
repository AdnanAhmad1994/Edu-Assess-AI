import * as pdfModule from "pdf-parse";
import mammoth from "mammoth";

export async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType === "application/pdf" || mimeType.includes("pdf")) {
      // Handle different export structures (v1 function vs v2 class/object)
      const pdf: any = (pdfModule as any).default || (pdfModule as any).PDFParse || pdfModule;
      
      try {
        if (typeof pdf === 'function') {
          // Try v1 function style or v2 constructor
          try {
            // v1 style
            const data = await pdf(buffer);
            return data.text || "";
          } catch (e) {
            // v2 style - instantiate if it's a class
            const instance = new pdf();
            if (typeof instance.parse === 'function') {
              const data = await instance.parse(buffer);
              return data.text || "";
            }
            // Fallback for v2.4.5 specific structure if known
            return "";
          }
        }
      } catch (err) {
        console.error("PDF extraction failed:", err);
      }
      return "";
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
