import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  FileText,
  Image,
  X,
} from "lucide-react";

interface DocumentViewerProps {
  url: string;
  name: string;
  type: string;
  onClose?: () => void;
  className?: string;
}

export function DocumentViewer({ url, name, type, onClose, className = "" }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const isImage = type?.startsWith("image/");
  const isPdf = type === "application/pdf" || name?.endsWith(".pdf");

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 25));

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && isExpanded) {
      setIsExpanded(false);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (isExpanded) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isExpanded, handleKeyDown]);

  return (
    <Card className={`overflow-visible ${isExpanded ? "fixed inset-4 z-50" : ""} ${className}`} data-testid="document-viewer">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isImage ? (
              <Image className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-medium truncate">{name}</span>
            <Badge variant="secondary">{isImage ? "Image" : isPdf ? "PDF" : "Document"}</Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= 25}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">{zoom}%</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= 300}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              data-testid="button-toggle-expand"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-viewer">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          className={`overflow-auto bg-muted/30 rounded-b-lg ${isExpanded ? "h-[calc(100vh-8rem)]" : "max-h-[500px]"}`}
          data-testid="document-viewer-content"
        >
          {isImage ? (
            <div className="flex items-center justify-center p-4">
              <img
                src={url}
                alt={name}
                style={{ width: `${zoom}%`, maxWidth: "none" }}
                className="object-contain transition-all duration-200"
                data-testid="document-viewer-image"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={`${url}#toolbar=0`}
              className="w-full border-0"
              style={{ height: isExpanded ? "calc(100vh - 8rem)" : "500px" }}
              title={name}
              data-testid="document-viewer-pdf"
            />
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm mb-2">Preview not available for this file type</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline"
                data-testid="link-download-document"
              >
                Download {name}
              </a>
            </div>
          )}
        </div>
      </CardContent>

      {isExpanded && (
        <div className="fixed inset-0 bg-black/50 -z-10" onClick={() => setIsExpanded(false)} />
      )}
    </Card>
  );
}

export function InlineImageViewer({ url, alt, className = "" }: { url: string; alt?: string; className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsExpanded(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isExpanded]);

  return (
    <>
      <div
        className={`relative cursor-pointer group ${className}`}
        onClick={() => setIsExpanded(true)}
        data-testid="inline-image-viewer"
      >
        <img
          src={url}
          alt={alt || "Question image"}
          className="max-w-full max-h-64 rounded-lg border object-contain"
        />
        <div className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg" />
        </div>
      </div>

      {isExpanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setIsExpanded(false)}
          data-testid="image-lightbox"
        >
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-4 right-4"
            onClick={() => setIsExpanded(false)}
            data-testid="button-close-lightbox"
          >
            <X className="w-5 h-5" />
          </Button>
          <img
            src={url}
            alt={alt || "Question image"}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </>
  );
}
