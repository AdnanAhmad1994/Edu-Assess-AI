import express, { Express } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

/**
 * Register object storage routes for file uploads.
 *
 * This provides example routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading
 * 2. The client then uploads directly to the presigned URL
 *
 * IMPORTANT: These are example routes. Customize based on your use case:
 * - Add authentication middleware for protected uploads
 * - Add file metadata storage (save to database after upload)
 * - Add ACL policies for access control
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid"
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        // Echo back the metadata for client convenience
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Local upload handler for PUT requests - returns Google Drive File ID in response
  app.put("/api/uploads/direct-upload/:uuid", express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
    try {
      const { uuid } = req.params;
      const buffer = req.body;
      
      if (!Buffer.isBuffer(buffer)) {
        console.error("Local upload error: Request body is not a buffer");
        return res.status(400).json({ error: "Invalid file content" });
      }

      console.log(`Received local upload for ${uuid}, size: ${buffer.length} bytes, type: ${req.headers['content-type']}`);
      const driveFileId = await objectStorageService.saveLocalObject(uuid, buffer, req.headers['content-type'] as string);
      
      // Return the Drive File ID so the client can reference it
      const objectPath = `/objects/${driveFileId}`;
      res.setHeader("Location", `/api/objects/${driveFileId}`);
      res.setHeader("X-Drive-File-Id", driveFileId);
      res.status(200).json({ fileId: driveFileId, objectPath });
    } catch (error) {
      console.error("Local upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /api/objects/:objectId?filename=name.pdf
   */
  app.get(/^\/api\/objects\/(.+)$/, async (req, res) => {
    try {
      const objectId = req.params[0];
      const filename = req.query.filename as string;
      const objectPath = `/objects/${objectId}`;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      await objectStorageService.downloadObject(objectFile, res, filename);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });

  /**
   * Delete uploaded objects.
   *
   * DELETE /api/objects/:objectId
   */
  app.delete(/^\/api\/objects\/(.+)$/, async (req, res) => {
    try {
      const objectId = req.params[0];
      await objectStorageService.deleteObject(objectId);
      res.json({ success: true, message: "Object deleted successfully" });
    } catch (error) {
      console.error("Error deleting object:", error);
      res.status(500).json({ error: "Failed to delete object" });
    }
  });

}

