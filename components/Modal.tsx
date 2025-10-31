"use client";
import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxWidth?: string; // e.g. "max-w-5xl"
}

export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  maxWidth = "max-w-3xl",
}: ModalProps) {
  // Disable body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center overflow-auto">
      <div
        className={`bg-white w-full ${maxWidth} rounded-xl shadow-lg p-6 relative animate-in fade-in duration-200`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-800"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Optional title */}
        {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}

        {/* Modal content */}
        <div>{children}</div>
      </div>
    </div>
  );
}
