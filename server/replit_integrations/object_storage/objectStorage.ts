import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

const UPLOADS_DIR = path.resolve(process.cwd(), "server", "uploads");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET || "lectures";

export const supabaseClient: SupabaseClient | null = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  async downloadObject(file: { localBuffer?: Buffer; path: string; uuid?: string }, res: Response, cacheTtlSec: number = 3600) {
    try {
      if (file.localBuffer) {
        res.set({
          "Content-Type": "application/octet-stream",
          "Content-Length": file.localBuffer.length,
          "Cache-Control": "private, max-age=" + cacheTtlSec,
        });
        res.send(file.localBuffer);
        return;
      }

      if (!supabaseClient) {
        throw new Error("Supabase client not initialized");
      }

      const objectId = file.uuid || file.path.split("/").pop();
      if (!objectId) throw new ObjectNotFoundError();

      const { data, error } = await supabaseClient.storage
        .from(supabaseBucket)
        .download(objectId);

      if (error || !data) {
        console.error("Supabase download error:", error);
        throw new ObjectNotFoundError();
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      
      res.set({
        "Content-Type": data.type || "application/octet-stream",
        "Content-Length": buffer.length,
        "Cache-Control": "private, max-age=" + cacheTtlSec,
      });

      res.send(buffer);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(404).json({ error: "File not found or storage error" });
      }
    }
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    // We stick with the proxy approach to keep frontend logic simple
    return `/api/uploads/direct-upload/${objectId}`;
  }

  async saveLocalObject(objectId: string, buffer: Buffer, contentType?: string): Promise<void> {
    // 1. Save locally as fallback
    if (!fs.existsSync(UPLOADS_DIR)) {
      await mkdir(UPLOADS_DIR, { recursive: true });
    }
    const filePath = path.join(UPLOADS_DIR, objectId);
    await writeFile(filePath, buffer);

    // 2. Upload to Supabase Storage
    if (supabaseClient) {
      console.log(`Uploading ${objectId} to Supabase bucket: ${supabaseBucket} with type: ${contentType}`);
      const { error } = await supabaseClient.storage
        .from(supabaseBucket)
        .upload(objectId, buffer, {
          upsert: true,
          contentType: contentType || "application/octet-stream",
        });
      
      if (error) {
        console.error("Supabase upload failure:", error);
        // We don't throw here to avoid failing the local upload, 
        // but it's a critical warning.
      } else {
        console.log(`Successfully uploaded ${objectId} to Supabase`);
      }
    }
  }

  async getLocalObject(objectId: string): Promise<Buffer | null> {
    const filePath = path.join(UPLOADS_DIR, objectId);
    if (fs.existsSync(filePath)) {
      return await readFile(filePath);
    }
    return null;
  }

  async getObjectEntityFile(objectPath: string): Promise<{ localBuffer?: Buffer; path: string; uuid?: string }> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const objectId = objectPath.split("/").pop();
    if (!objectId) throw new ObjectNotFoundError();
    
    // Check local first
    const localBuffer = await this.getLocalObject(objectId);
    if (localBuffer) {
      return { localBuffer, path: objectPath, uuid: objectId };
    }

    // Return reference for Supabase fetch in downloadObject
    return { path: objectPath, uuid: objectId };
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/api/uploads/direct-upload/")) {
      const objectId = rawPath.split("/").pop();
      return `/objects/${objectId}`;
    }
    if (rawPath.includes("supabase.co/storage")) {
      const objectId = rawPath.split("/").pop();
      return `/objects/${objectId}`;
    }
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(rawPath: string, _policy: any): Promise<string> {
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(_args: any): Promise<boolean> {
    return true; // Simplified for now
  }
}


