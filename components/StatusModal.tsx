"use client";
import React from "react";

interface StatusModalProps {
  open: boolean;
  message: string;
  type?: "loading" | "success" | "error" | "info";
}

export default function StatusModal({ open, message, type = "info" }: StatusModalProps) {
  if (!open) return null;

  const colorMap = {
    loading: "text-blue-600",
    success: "text-green-600",
    error: "text-red-600",
    info: "text-gray-700",
  };

  const emojiMap = {
    loading: "⏳",
    success: "✅",
    error: "❌",
    info: "ℹ️",
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white px-8 py-6 rounded-xl shadow-md text-center">
        <div className="text-3xl mb-3">{emojiMap[type]}</div>
        <p className={`font-medium ${colorMap[type]}`}>{message}</p>
      </div>
    </div>
  );
}
