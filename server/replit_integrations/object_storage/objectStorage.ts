import { google } from "googleapis";
import { Response } from "express";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { Readable } from "stream";

const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";

console.log("ObjectStorageService initialization:", {
  email: clientEmail,
  hasPrivateKey: !!privateKey,
  folderId: folderId,
});


const credentials = (clientEmail && privateKey) ? {
  client_email: clientEmail,
  private_key: privateKey,
} : null;

if (!credentials) {
  console.error("CRITICAL: Google Drive credentials missing. Please check GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.");
}

export const auth = credentials
  ? new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive",
      ],
    })
  : null;

if (auth) {
  console.log("Google Auth initialized successfully.");
}

export const driveClient = auth ? google.drive({ version: "v3", auth }) : null;

if (driveClient) {
  console.log("Google Drive client initialized successfully.");
} else {
  console.error("CRITICAL: Google Drive client NOT initialized.");
}


export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  async downloadObject(file: { localBuffer?: Buffer; path: string; uuid?: string }, res: Response, filename?: string, cacheTtlSec: number = 3600) {
    try {
      const buffer = await this.getObjectBuffer(file.uuid || "");
      if (!buffer) throw new ObjectNotFoundError();

      if (!driveClient) {
        throw new Error("Google Drive client not initialized");
      }

      const metadata = await driveClient.files.get({
        fileId: file.uuid!,
        fields: "mimeType, size, name",
      });

      const finalFilename = filename || metadata.data.name || "download";
      const safeFilename = finalFilename.replace(/"/g, '');
      
      res.set({
        "Content-Type": metadata.data.mimeType || "application/octet-stream",
        "Content-Length": buffer.length,
        "Cache-Control": "private, max-age=" + cacheTtlSec,
        "Content-Disposition": `attachment; filename="${safeFilename}"; filename*="UTF-8''${encodeURIComponent(finalFilename)}"`,
      });

      res.send(buffer);
    } catch (error) {
      console.error("Error downloading from Google Drive:", error);
      if (!res.headersSent) {
        res.status(404).json({ error: "File not found or storage error" });
      }
    }
  }

  async getObjectBuffer(objectId: string): Promise<Buffer | null> {
    try {
      if (!driveClient) {
        console.warn("getObjectBuffer: driveClient not initialized");
        return null;
      }
      
      console.log(`Fetching buffer from Google Drive: ${objectId}`);
      const response = await driveClient.files.get(
        { fileId: objectId, alt: "media" },
        { responseType: "arraybuffer" }
      );
      return Buffer.from(response.data as ArrayBuffer);
    } catch (error: any) {
      console.error(`Error getting object buffer for ${objectId}:`, error.message);
      if (error.code === 404) {
        console.error(`File ID ${objectId} not found on Google Drive. This usually means the upload failed or the ID is a local UUID instead of a Drive ID.`);
      }
      return null;
    }
  }

  async deleteObject(fileId: string): Promise<void> {
    console.log(`Deleting file from Google Drive: ${fileId}`);
    
    if (!driveClient) {
      console.warn("deleteObject: driveClient not initialized");
      return;
    }

    try {
      await driveClient.files.delete({ fileId });
      console.log(`Successfully deleted file from Google Drive: ${fileId}`);
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`File ${fileId} not found on Google Drive, skipping.`);
      } else {
        console.error(`Error deleting from Google Drive (${fileId}):`, error.message);
        throw error;
      }
    }
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    return `/api/uploads/direct-upload/${objectId}`;
  }

  async saveLocalObject(objectId: string, buffer: Buffer, contentType?: string): Promise<string> {
    console.log(`saveLocalObject initiation for objectId: ${objectId}`);
    
    if (driveClient && auth && folderId) {
      console.log(`Uploading to Google Drive folder: ${folderId}`);
      
      try {
        const fileMetadata = {
          name: objectId,
          parents: [folderId],
        };
        
        const media = {
          mimeType: contentType || "application/octet-stream",
          body: Readable.from(buffer),
        };

        const file = await driveClient.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: "id",
        });

        if (file.data.id) {
          console.log(`Successfully uploaded to Google Drive. Drive File ID: ${file.data.id}`);
          return file.data.id;
        } else {
          console.warn(`Google Drive upload returned no ID, falling back to UUID: ${objectId}`);
          return objectId;
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("storage quota")) {
          console.error("ERROR: Service Account storage quota exceeded. You MUST share your Google Drive folder with the service account email address as an 'Editor'.");
          console.error(`Please share folder '${folderId}' with: ${clientEmail}`);
        }
        console.warn(`Upload failed, falling back to UUID: ${objectId}`);
        return objectId;
      }

    } else {
      console.warn("Skipping Google Drive upload: missing configuration", {
        hasDriveClient: !!driveClient,
        hasAuth: !!auth,
        hasFolderId: !!folderId
      });
      return objectId;
    }
  }


  async getObjectEntityFile(objectPath: string): Promise<{ localBuffer?: Buffer; path: string; uuid?: string }> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const objectId = objectPath.split("/").pop();
    if (!objectId) throw new ObjectNotFoundError();
    
    return { path: objectPath, uuid: objectId };
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (rawPath.startsWith("/api/uploads/direct-upload/")) {
      const objectId = rawPath.split("/").pop();
      return `/objects/${objectId}`;
    }
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(rawPath: string, _policy: any): Promise<string> {
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(_args: any): Promise<boolean> {
    return true; 
  }
}



