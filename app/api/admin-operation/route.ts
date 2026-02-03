import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { operation, table, data, filters, conflictColumns } = await req.json();

    // Use service role to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let result;

    switch (operation) {
      case "insert":
        result = await supabase.from(table).insert(data).select();
        break;

      case "upsert":
        // Upsert will insert or update based on conflict columns
        const upsertOptions: any = { onConflict: conflictColumns?.join(',') || undefined };
        result = await supabase.from(table).upsert(data, upsertOptions).select();
        break;

      case "update":
        let updateQuery = supabase.from(table).update(data);
        
        // Apply filters
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            updateQuery = updateQuery.eq(key, value as string);
          });
        }
        
        result = await updateQuery.select();
        break;

      case "delete":
        let deleteQuery = supabase.from(table).delete();
        
        // Apply filters
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            deleteQuery = deleteQuery.eq(key, value as string);
          });
        }
        
        result = await deleteQuery;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid operation" },
          { status: 400 }
        );
    }

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error: any) {
    console.error("Admin operation error:", error);
    return NextResponse.json(
      { error: error.message || "Operation failed" },
      { status: 500 }
    );
  }
}
