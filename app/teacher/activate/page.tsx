"use client";

import { useEffect, useState } from "react";

export default function ActivateTeacherPage() {
  const [status, setStatus] = useState("Verifying...");
  const [color, setColor] = useState("text-gray-500");

  useEffect(() => {
    const activateAccount = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (!token) {
        setStatus("Invalid activation link.");
        setColor("text-red-500");
        return;
      }

      try {
        const res = await fetch(`/api/teacher`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            token,
            type: "activate"
           }),
        });

        const data = await res.json();

        if (data.success) {
          setStatus("Your account has been activated successfully! 🎉");
          setColor("text-green-600");
          // Optionally, redirect to login page after a delay
          setTimeout(() => {
            window.location.href = "/teacher/login";
          }, 2000);
        } else {
          setStatus(data.message || "Activation failed.");
          setColor("text-red-500");
        }
      } catch (err) {
        console.error(err);
        setStatus("Something went wrong. Try again later.");
        setColor("text-red-500");
      }
    };

    activateAccount();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className={`text-2xl font-semibold ${color}`}>{status}</h1>
    </div>
  );
}
