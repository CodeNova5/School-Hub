import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/dbConnect";
import Admission from "@/models/Admission";
import Link from "next/link";

export default async function SuccessPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    // ✅ Await the promise-based params (Next.js 15+)
    const { id } = await params;

    // ✅ Connect to MongoDB
    await dbConnect();

    // ✅ Fetch the admission record by ID
    const admission: Record<string, any> | null = await Admission.findById(id).lean();

    // ❌ If not found, show Next.js 404
    if (!admission) return notFound();

    // ✅ Format createdAt date nicely
    const formatDate = (date: any) =>
        new Date(date).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });

    return (
        <div className="max-w-4xl bg-white text-black mx-auto py-12 px-6">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-green-700 mb-3">
                    🎉 Application Submitted Successfully!
                </h1>
                <p className="text-gray-600">
                    Thank you for applying to our school. Your admission details are below.
                </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-300 shadow-sm">
                <table className="min-w-full border-collapse text-sm">
                    <tbody>
                        {Object.entries(admission).map(([key, value]) => {
                            // skip MongoDB internal fields
                            if (["_id", "__v"].includes(key)) return null;

                            return (
                                <tr key={key} className="border-b hover:bg-gray-50">
                                    <td className="font-medium px-4 py-2 bg-gray-100 capitalize whitespace-nowrap">
                                        {key.replace(/([A-Z])/g, " $1")}
                                    </td>
                                    <td className="px-4 py-2">
                                        {key.includes("Date") || key.includes("createdAt")
                                            ? formatDate(value)
                                            : String(value)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-10 text-center">
                <p className="text-sm text-gray-500">
                    Your application ID:{" "}
                    <span className="font-mono text-gray-700">{admission._id.toString()}</span>
                </p>
                <p className="text-sm text-gray-500 mt-2">
                    Submitted on: {formatDate(admission.createdAt)}
                </p>
            </div>

            <div className="mt-8 text-center">
               <Link href="/" className="text-blue-600 hover:underline">
                    Return To Homepage
                </Link>
            </div>
        </div>
    );
}
