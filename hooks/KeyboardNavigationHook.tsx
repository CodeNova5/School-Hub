import { useEffect } from "react";

function useSubmissionKeyboardNav({
  enabled,
  currentIndex,
  submissions,
  onChange,
  onClose,
}: {
  enabled: boolean;
  currentIndex: number;
  submissions: any[];
  onChange: (submission: any) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentIndex < submissions.length - 1) {
          onChange(submissions[currentIndex + 1]);
        }
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentIndex > 0) {
          onChange(submissions[currentIndex - 1]);
        }
      }

      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, currentIndex, submissions, onChange, onClose]);
}
export default useSubmissionKeyboardNav;