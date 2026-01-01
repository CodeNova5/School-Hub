import { FileText } from "lucide-react";

interface FilePreviewProps {
  fileUrl: string;
}

export function FilePreview({ fileUrl }: FilePreviewProps) {
  if (!fileUrl) return null;

  const ext = fileUrl.split(".").pop()?.toLowerCase();
  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext!);
  const isPdf = ext === "pdf";
  const isOffice = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext!);
  const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
    fileUrl
  )}&embedded=true`;

  return (
    <div>
      <p className="font-medium mb-2">Attached File</p>
      <div className="border rounded-lg p-4">
        {isImage && (
          <img
            src={fileUrl}
            className="w-full max-h-96 object-contain rounded-lg border"
          />
        )}
        {isPdf && (
          <iframe
            src={fileUrl}
            className="w-full h-[60vh] rounded-md border"
          />
        )}
        {isOffice && (
          <iframe
            src={googleViewerUrl}
            className="w-full h-[60vh] rounded-md border"
          />
        )}
        {!isImage && !isPdf && !isOffice && (
          <div className="flex items-center gap-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {fileUrl.split("/").pop()}
              </p>
              <a
                href={fileUrl}
                target="_blank"
                className="text-sm text-primary hover:underline"
              >
                Download File
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
