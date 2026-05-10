import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ScrapedQuestion = {
  id?: string;
  question: string;
  options: string[];
  answerLink: string | null;
  correct?: string;
  explanation?: string;
  image?: string | null;
};

function clean(text: string) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function cleanRichText(text: string) {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parsePageNumber(value: string | null, fallback: number) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function getCurrentStudent() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: student, error } = await supabaseAdmin
    .from("students")
    .select("id, school_id")
    .eq("user_id", user.id)
    .single();

  if (error || !student) {
    return { error: "Student profile not found", status: 404 };
  }

  return { student, userId: user.id };
}

async function scrapeQuestions(
  origin: string,
  subject: string,
  year: string,
  topic: string,
  page: number,
  limit: number
) {
  const url = new URL("/api/scrape/questions", origin);
  url.searchParams.set("subject", subject);
  url.searchParams.set("year", year);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));

  if (topic) {
    url.searchParams.set("topic", topic);
  }

  url.searchParams.set("detail", "true");

  console.info("[student/jamb/questions] scrape request", {
    subject,
    year,
    topic,
    page,
    limit,
    url: url.toString(),
  });

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to scrape questions: ${response.status}`);
  }

  const payload = await response.json();
  return {
    questions: Array.isArray(payload.questions) ? (payload.questions as ScrapedQuestion[]) : [],
    page: Number(payload.page) || page,
    totalPages: Number(payload.totalPages) || page,
    count: Number(payload.count) || 0,
    url: String(payload.url || url.toString()),
  };
}

export async function GET(req: NextRequest) {
  try {
    const currentStudent = await getCurrentStudent();
    if ("error" in currentStudent) {
      return NextResponse.json(
        { error: currentStudent.error },
        { status: currentStudent.status }
      );
    }

    const { student } = currentStudent;
    const url = new URL(req.url);
    const subject = url.searchParams.get("subject") || "";
    const subjectName = url.searchParams.get("subjectName") || "";
    const year = url.searchParams.get("year") || "";
    const topic = url.searchParams.get("topic") || "";
    const limit = Number(url.searchParams.get("limit") || "5");
    const page = parsePageNumber(url.searchParams.get("page"), 1);

    if (!subject || !year) {
      return NextResponse.json(
        { error: "subject and year are required" },
        { status: 400 }
      );
    }

    const normalizedTopic = topic === "__all_topics__" ? "" : topic;
    const origin = url.origin;

    const scraped = await scrapeQuestions(
      origin,
      subject,
      year,
      normalizedTopic,
      page,
      limit
    );

    const rows = scraped.questions
      .map((question: ScrapedQuestion, index: number) => {
        if (!clean(question.question)) {
          return null;
        }

        const pageScopedId = `${subject}-${year}-${normalizedTopic || "all"}-${page}-${index + 1}`;
        const sourceId = clean(question.id || "");

        return {
          school_id: student.school_id,
          exam_type: "jamb",
          subject_slug: subject,
          subject_name: subjectName || subject,
          exam_year: Number(year),
          topic: normalizedTopic || null,
          question_text: cleanRichText(question.question || ""),
          options: Array.isArray(question.options) ? question.options : [],
          correct_option: clean(question.correct || "") || null,
          explanation: cleanRichText(question.explanation || "") || null,
          source_url: question.answerLink || null,
          image_url: question.image || null,
          external_question_id: sourceId ? `${pageScopedId}-${sourceId}` : pageScopedId,
        };
      })
      .filter(Boolean) as Array<{
      school_id: string;
      exam_type: string;
      subject_slug: string;
      subject_name: string;
      exam_year: number;
      topic: string | null;
      question_text: string;
      options: string[];
      correct_option: string | null;
      explanation: string | null;
      source_url: string | null;
      image_url: string | null;
      external_question_id: string;
    }>;

    const externalIds = rows.map((row) => row.external_question_id);
    const { data: existingRows, error: existingError } = externalIds.length
      ? await supabaseAdmin
          .from("jamb_questions")
          .select("id, external_question_id")
          .eq("school_id", student.school_id)
          .eq("subject_slug", subject)
          .eq("exam_year", Number(year))
          .in("external_question_id", externalIds)
      : { data: [], error: null };

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const existingByExternalId = new Map(
      (existingRows || []).map((row: any) => [String(row.external_question_id), row])
    );
    const existingExternalIds = new Set(existingByExternalId.keys());
    const missingRows = rows.filter((row) => !existingExternalIds.has(row.external_question_id));

    if (missingRows.length > 0) {
      const { error: insertError } = await supabaseAdmin.from("jamb_questions").insert(missingRows);

      if (insertError) {
        console.error("[student/jamb/questions] insert failed", {
          message: insertError.message,
          page,
          subject,
          year,
          topic: normalizedTopic,
          inserted: missingRows.length,
        });
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    const rowsToRefresh = rows.filter((row) => existingExternalIds.has(row.external_question_id));
    if (rowsToRefresh.length > 0) {
      const refreshPromises = rowsToRefresh.map(async (row) => {
        const existing = existingByExternalId.get(row.external_question_id);
        if (!existing?.id) return;

        const { error: updateError } = await supabaseAdmin
          .from("jamb_questions")
          .update({
            question_text: row.question_text,
            options: row.options,
            correct_option: row.correct_option,
            explanation: row.explanation,
            source_url: row.source_url,
            image_url: row.image_url,
          })
          .eq("id", existing.id);

        if (updateError) {
          console.error("[student/jamb/questions] refresh failed", {
            id: existing.id,
            externalQuestionId: row.external_question_id,
            message: updateError.message,
          });
        }
      });

      await Promise.all(refreshPromises);
    }

    const { data: storedQuestions, error: storedError } = await supabaseAdmin
      .from("jamb_questions")
      .select(
        "id, external_question_id, question_text, options, subject_slug, subject_name, exam_year, topic, correct_option, explanation, image_url"
      )
      .eq("school_id", student.school_id)
      .eq("subject_slug", subject)
      .eq("exam_year", Number(year))
      .in("external_question_id", externalIds);

    if (storedError) {
      return NextResponse.json({ error: storedError.message }, { status: 500 });
    }

    const storedByExternalId = new Map(
      (storedQuestions || []).map((row: any) => [String(row.external_question_id), row])
    );

    const questions = rows
      .map((row) => {
        const stored = storedByExternalId.get(row.external_question_id);

        if (!stored) {
          return null;
        }

        return {
          id: stored.id,
          question_text: stored.question_text,
          options: Array.isArray(stored.options) ? stored.options : [],
          subject_slug: stored.subject_slug,
          subject_name: stored.subject_name,
          exam_year: stored.exam_year,
          topic: stored.topic,
          correct_option: stored.correct_option,
          explanation: stored.explanation,
          image_url: stored.image_url || null,
        };
      })
      .filter(Boolean);

    const totalPages = Number(scraped.totalPages) || page;

    console.info("[student/jamb/questions] response", {
      subject,
      year,
      topic: normalizedTopic,
      page,
      pageSize: limit,
      scrapedCount: scraped.count,
      returnedCount: questions.length,
      totalPages,
      insertedCount: missingRows.length,
    });

    return NextResponse.json({
      data: {
        questions,
        count: questions.length,
        page,
        totalPages,
        pageSize: limit,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error("[student/jamb/questions] error", {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: error?.message || "Failed to load JAMB questions" },
      { status: 500 }
    );
  }
}