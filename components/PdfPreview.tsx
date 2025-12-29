import { Document, Page } from "react-pdf";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PdfPreview({ url }: { url: string }) {
  const [numPages, setNumPages] = useState<number>();
  const [page, setPage] = useState(1);

  return (
    <div className="flex flex-col items-center gap-3">
      <Document
        file={{
          url
        }}
        options={{
          disableRange: true,
          disableStream: true,
        }}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        loading={<p className="text-sm text-muted-foreground">Loading PDF…</p>}
        error={<p className="text-sm text-red-500">Failed to load PDF</p>}
      >

        <Page
          pageNumber={page}
          width={500}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </Document>

      {/* PDF Controls */}
      {numPages && (
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm text-muted-foreground">
            Page {page} of {numPages}
          </span>

          <Button
            size="icon"
            variant="secondary"
            disabled={page >= numPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
