"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function AdmissionSuccessContent() {
  const params = useSearchParams();
  const admissionData = params.get("data")
    ? JSON.parse(decodeURIComponent(params.get("data")!))
    : null;

  if (!admissionData) {
    return (
      <div className="max-w-3xl mx-auto text-center mt-20">
        <h2 className="text-xl font-semibold">No admission record found.</h2>
      </div>
    );
  }

  const {
    firstName,
    lastName,
    middleName,
    gender,
    dateOfBirth,
    address,
    classApplyingFor,
    parentFirstName,
    parentLastName,
    parentEmail,
    parentPhone,
    parentAddress,
    status,
  } = admissionData;

  return (
    <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-2xl p-8 mt-10">
      <h2 className="text-2xl font-bold text-green-600 text-center mb-4">
        🎉 Application Submitted Successfully!
      </h2>
      <p className="text-center mb-6 text-gray-600">
        Your application has been received and a confirmation email has been sent to{" "}
        <strong>{parentEmail}</strong>.
      </p>

      <h3 className="text-lg font-semibold mb-2 border-b pb-2">
        Submitted Information
      </h3>

      <table className="w-full border text-sm">
        <tbody>
          <tr><td className="border p-2 font-semibold">Student Name</td><td className="border p-2">{firstName} {middleName} {lastName}</td></tr>
          <tr><td className="border p-2 font-semibold">Gender</td><td className="border p-2">{gender}</td></tr>
          <tr><td className="border p-2 font-semibold">Date of Birth</td><td className="border p-2">{new Date(dateOfBirth).toLocaleDateString()}</td></tr>
          <tr><td className="border p-2 font-semibold">Address</td><td className="border p-2">{address}</td></tr>
          <tr><td className="border p-2 font-semibold">Class Applying For</td><td className="border p-2">{classApplyingFor}</td></tr>
          <tr><td className="border p-2 font-semibold">Parent Name</td><td className="border p-2">{parentFirstName} {parentLastName}</td></tr>
          <tr><td className="border p-2 font-semibold">Parent Email</td><td className="border p-2">{parentEmail}</td></tr>
          <tr><td className="border p-2 font-semibold">Parent Phone</td><td className="border p-2">{parentPhone}</td></tr>
          <tr><td className="border p-2 font-semibold">Parent Address</td><td className="border p-2">{parentAddress}</td></tr>
          <tr><td className="border p-2 font-semibold">Application Status</td><td className="border p-2 capitalize">{status}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export default function AdmissionSuccess() {
  return (
    <Suspense fallback={<div className="text-center mt-20">Loading...</div>}>
      <AdmissionSuccessContent />
    </Suspense>
  );
}
