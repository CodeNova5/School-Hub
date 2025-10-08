"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";



interface AdmissionFormData {
  studentFirstName: string;
  studentLastName: string;
  studentMiddleName: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  parentFirstName: string;
  parentLastName: string;
  parentMiddleName: string;
  parentEmail: string;
  parentPhone: string;
  parentAddress: string;
  classApplyingFor: string;
}


export default function AdmissionForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<AdmissionFormData>({
    studentFirstName: "",
    studentLastName: "",
    studentMiddleName: "",
    dateOfBirth: "",
    gender: "",
    address: "",
    parentFirstName: "",
    parentLastName: "",
    parentMiddleName: "",
    parentEmail: "",
    parentPhone: "",
    parentAddress: "",
    classApplyingFor: "",
  });


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const res = await fetch("/api/admission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  const data = await res.json();

  if (res.ok) {
    // redirect to thank you page with admission ID
    router.push(`/admission/success/${data._id}`);
  } else {
    alert(data.message || "Something went wrong");
  }
};

  return (
    <div className="max-w-4xl mx-auto bg-white text-black p-8 rounded-2xl shadow-md">
      <h2 className="text-2xl font-semibold mb-6 text-center">Admission Form</h2>
      <form onSubmit={handleSubmit} className="space-y-8">

        {/* --- Student Info --- */}
        {/* --- Student Info --- */}
        <section>
          <h3 className="text-lg font-semibold mb-4 border-b pb-2">Student Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="studentFirstName"
                value={formData.studentFirstName}
                onChange={handleChange}
                required
                className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="studentLastName"
                value={formData.studentLastName}
                onChange={handleChange}
                required
                className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                Middle Name (Optional)
              </label>
              <input
                type="text"
                name="studentMiddleName"
                value={formData.studentMiddleName}
                onChange={handleChange}
                className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Gender *</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                required
                className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Date of Birth *</label>
              <input
                type="date"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                required
                className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Address *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
              />
            </div>
          </div>
        </section>


        {/* --- Parent Info --- */}
        <section>
          <h3 className="text-lg font-semibold mb-4 border-b pb-2">Parent / Guardian Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "First Name", name: "parentFirstName" },
              { label: "Last Name", name: "parentLastName" },
              { label: "Middle Name (Optional)", name: "parentMiddleName" },
            ].map(({ label, name }) => (
              <div key={name}>
                <label className="block text-sm font-semibold mb-1">
                  {label} {label.includes("Optional") ? "" : <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  name={name}
                  value={formData[name as keyof AdmissionFormData]}
                  onChange={handleChange}
                  className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
                  required={!label.includes("Optional")}
                />
              </div>
            ))}

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-semibold mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                name="parentEmail"
                value={formData.parentEmail}
                onChange={handleChange}
                required
                className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="parentPhone"
                value={formData.parentPhone}
                onChange={handleChange}
                required
                className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold mb-1">
              Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="parentAddress"
              value={formData.parentAddress}
              onChange={handleChange}
              required
              className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
            />
          </div>
        </section>

        {/* --- Class Selection --- */}
        <section>
          <h3 className="text-lg font-semibold mb-4 border-b pb-2">Class Selection</h3>
          <label className="block text-sm font-semibold mb-1">
            Select Class <span className="text-red-500">*</span>
          </label>
          <select
            name="classApplyingFor"
            value={formData.classApplyingFor}
            onChange={handleChange}
            required
            className="w-full border rounded-lg p-2 focus:ring focus:ring-blue-300"
          >
            <option value="">-- Select Class --</option>

            <optgroup label="PRE-PRIMARY EDUCATION">
              <option value="Creche">Creche</option>
              <option value="Kindergarten 1">Kindergarten 1</option>
              <option value="Kindergarten 2">Kindergarten 2</option>
              <option value="Nursery 1">Nursery 1</option>
              <option value="Nursery 2">Nursery 2</option>
            </optgroup>

            <optgroup label="PRIMARY EDUCATION">
              <option value="Primary 1">Primary 1</option>
              <option value="Primary 2">Primary 2</option>
              <option value="Primary 3">Primary 3</option>
              <option value="Primary 4">Primary 4</option>
              <option value="Primary 5">Primary 5</option>
              <option value="Primary 6">Primary 6</option>
            </optgroup>

            <optgroup label="JUNIOR SECONDARY SCHOOL">
              <option value="JSS 1">JSS 1</option>
              <option value="JSS 2">JSS 2</option>
              <option value="JSS 3">JSS 3</option>
            </optgroup>

            <optgroup label="SENIOR SECONDARY SCHOOL">
              <option value="SS 1">SS 1</option>
              <option value="SS 2">SS 2</option>
              <option value="SS 3">SS 3</option>
            </optgroup>
          </select>
        </section>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
        >
          Submit Application
        </button>
      </form>
    </div>
  );
}
