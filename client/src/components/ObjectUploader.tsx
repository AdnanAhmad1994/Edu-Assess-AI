import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import type { UppyFile, UploadResult } from "@uppy/core";
import DashboardModal from "@uppy/react/dashboard-modal";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import { Button } from "@/components/ui/button";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  /**
   * Function to get upload parameters for each file.
   * IMPORTANT: This receives the file object - use file.name, file.size, file.type
   * to request per-file presigned URLs from your backend.
   */
  onGetUploadParameters: (
    file: UppyFile<Record<string, unknown>, Record<string, unknown>>
  ) => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A file upload component that renders as a button and provides a modal interface for
 * file management.
 *
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for:
 *   - File selection
 *   - File preview
 *   - Upload progress tracking
 *   - Upload status display
 *
 * The component uses Uppy v5 under the hood to handle all file upload functionality.
 * All file management features are automatically handled by the Uppy dashboard modal.
 *
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed to be uploaded
 *   (default: 1)
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onGetUploadParameters - Function to get upload parameters for each file.
 *   Receives the UppyFile object with file.name, file.size, file.type properties.
 *   Use these to request per-file presigned URLs from your backend. Returns method,
 *   url, and optional headers for the upload request.
 * @param props.onComplete - Callback function called when upload is complete. Typically
 *   used to make post-upload API calls to update server state and set object ACL
 *   policies.
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const objectPaths = useRef<Record<string, string>>({});

  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: async (file) => {
          const params = await onGetUploadParameters(file);
          if ((params as any).meta?.objectPath) {
            objectPaths.current[file.id] = (params as any).meta.objectPath;
            // Also try setting it on uppy for good measure
            uppy.setFileMeta(file.id, (params as any).meta);
          }
          return params;
        },
      })
  );

  useEffect(() => {
    const handleComplete = (result: any) => {
      console.log("Uppy complete event:", result);
      // Inject objectPath from our local map if it's missing in Uppy's result
      result.successful.forEach((file: any) => {
        if (!file.meta.objectPath && objectPaths.current[file.id]) {
          file.meta.objectPath = objectPaths.current[file.id];
        }
      });
      onComplete?.(result);
    };

    const handleSuccess = async (file: any, response: any) => {
      console.log("Uppy upload-success event:", file.id, response);
      
      // Try to read the Drive File ID from the server's response body
      try {
        const responseBody = response.body;
        if (responseBody && responseBody.objectPath) {
          // Server returned Drive File ID reference - use it
          const driveObjectPath = responseBody.objectPath;
          objectPaths.current[file.id] = driveObjectPath;
          uppy.setFileMeta(file.id, { objectPath: driveObjectPath });
          console.log("Updated objectPath from server response:", driveObjectPath);
        } else if (!file.meta.objectPath && objectPaths.current[file.id]) {
          uppy.setFileMeta(file.id, { objectPath: objectPaths.current[file.id] });
        }
      } catch (e) {
        // Fallback to original path if response parsing fails
        if (!file.meta.objectPath && objectPaths.current[file.id]) {
          uppy.setFileMeta(file.id, { objectPath: objectPaths.current[file.id] });
        }
      }
    };

    const handleError = (file: any, error: any, response: any) => {
      console.error("Uppy upload-error event:", file?.id, error, response);
    };

    uppy.on("complete", handleComplete);
    uppy.on("upload-success", handleSuccess);
    uppy.on("upload-error", handleError);

    return () => {
      uppy.off("complete", handleComplete);
      uppy.off("upload-success", handleSuccess);
      uppy.off("upload-error", handleError);
    };
  }, [uppy, onComplete]);

  return (
    <div>
      <Button onClick={() => setShowModal(true)} className={buttonClassName}>
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
}

