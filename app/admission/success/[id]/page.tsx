import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/dbConnect";
import Admission from "@/lib/models/Admission";

interface Params {
  params: { id: string };
}

export default async function SuccessPage({ params }: Params) {
  await dbConnect();
  const admission = await Admission.findById(params.id).lean();

  if (!admission) return notFound();

  return (
    <div className="max-w-3xl mx-auto py-10">
      <h1 className="text-2xl font-semibold mb-6 text-center text-green-700">
        ✅ Application Submitted Successfully!
      </h1>

      <p className="text-center mb-8 text-gray-600">
        Thank you for applying. Below are your details:
      </p>

      <table className="min-w-full border text-sm border-gray-300 rounded-lg">
        <tbody>
          {Object.entries(admission).map(([key, value]) => (
            <tr key={key} className="border-b">
              <td className="font-medium px-4 py-2 bg-gray-50 capitalize">
                {key.replace(/([A-Z])/g, " $1")}
              </td>
              <td className="px-4 py-2">{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
