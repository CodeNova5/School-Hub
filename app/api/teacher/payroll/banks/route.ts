import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-helpers";

interface PaystackBank {
  name: string;
  slug: string;
  code: string;
  active: boolean;
  country: string;
  currency: string;
  type: string;
  id: number;
}

interface PaystackBanksResponse {
  status: boolean;
  message: string;
  data: PaystackBank[];
}

export async function GET(_req: NextRequest) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return errorResponse("PAYSTACK_SECRET_KEY is not configured", 500);
  }

  try {
    const res = await fetch(
      "https://api.paystack.co/bank?country=nigeria&perPage=100&pay_with_bank=false",
      {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      return errorResponse("Failed to fetch banks from Paystack", 502);
    }

    const data = (await res.json()) as PaystackBanksResponse;

    if (!data.status || !Array.isArray(data.data)) {
      return errorResponse("Invalid response from Paystack", 502);
    }

    // Return only active Nigerian banks sorted alphabetically
    const banks = data.data
      .filter((b) => b.active && b.country === "Nigeria")
      .map((b) => ({
        name: b.name,
        code: b.code,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return successResponse(banks);
  } catch (err) {
    console.error("Error fetching Paystack banks:", err);
    return errorResponse("Failed to connect to Paystack", 502);
  }
}
