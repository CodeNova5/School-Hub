import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function clean(text: string) {
  return (text || "").replace(/\s+/g, " ").trim();
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

async function scrapeQuestions(origin: string, subject: string, year: string, topic: string) {
  const url = new URL("/api/scrape/questions", origin);
  url.searchParams.set("subject", subject);
  url.searchParams.set("year", year);

  if (topic) {
    url.searchParams.set("topic", topic);
  }

  url.searchParams.set("detail", "true");

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
  return Array.isArray(payload.questions) ? payload.questions : [];
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
    const limit = Number(url.searchParams.get("limit") || "20");

    if (!subject || !year) {
      return NextResponse.json(
        { error: "subject and year are required" },
        { status: 400 }
      );
    }

    const normalizedTopic = topic === "__all_topics__" ? "" : topic;
    const origin = url.origin;

    const query = supabaseAdmin
      .from("jamb_questions")
      .select(
        "id, question_text, options, subject_slug, subject_name, exam_year, topic, correct_option, explanation"
      )
      .eq("school_id", student.school_id)
      .eq("subject_slug", subject)
      .eq("exam_year", Number(year));

    if (normalizedTopic) {
      query.eq("topic", normalizedTopic);
    }

    let { data: existingQuestions, error: existingError } = await query
      .order("created_at", { ascending: true })
      .limit(limit);

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (!existingQuestions || existingQuestions.length === 0) {
      const scrapedQuestions = await scrapeQuestions(
        origin,
        subject,
        year,
        normalizedTopic
      );

      const rows = scrapedQuestions
        .map((question: any, index: number) => {
          const correctOption = clean(question.correct || "");
          if (!correctOption) {
            return null;
          }

          return {
            school_id: student.school_id,
            exam_type: "jamb",
            subject_slug: subject,
            subject_name: subjectName || question.subject_name || subject,
            exam_year: Number(year),
            topic: normalizedTopic || null,
            question_text: clean(question.question || ""),
            options: Array.isArray(question.options) ? question.options : [],
            correct_option: correctOption,
            explanation: clean(question.explanation || "") || null,
            source_url: question.answerLink || null,
            external_question_id:
              question.id || `${subject}-${year}-${normalizedTopic || "all"}-${index + 1}`,
          };
        })
        .filter(Boolean);

      if (rows.length > 0) {
        const { error: insertError } = await supabaseAdmin.from("jamb_questions").insert(rows);

        if (insertError) {
          return NextResponse.json(
            { error: insertError.message },
            { status: 500 }
          );
        }
      }

      const { data: refreshedQuestions, error: refreshError } = await supabaseAdmin
        .from("jamb_questions")
        .select(
          "id, question_text, options, subject_slug, subject_name, exam_year, topic, correct_option, explanation"
        )
        .eq("school_id", student.school_id)
        .eq("subject_slug", subject)
        .eq("exam_year", Number(year));

      if (refreshError) {
        return NextResponse.json(
          { error: refreshError.message },
          { status: 500 }
        );
      }

      existingQuestions = normalizedTopic
        ? (refreshedQuestions || []).filter((row: any) => row.topic === normalizedTopic)
        : refreshedQuestions || [];
    }

    const questions = (existingQuestions || []).slice(0, limit).map((row: any) => ({
      id: row.id,
      question_text: row.question_text,
      options: Array.isArray(row.options) ? row.options : [],
      subject_slug: row.subject_slug,
      subject_name: row.subject_name,
      exam_year: row.exam_year,
      topic: row.topic,
      correct_option: row.correct_option,
      explanation: row.explanation,
    }));

    return NextResponse.json({
      data: {
        questions,
        count: questions.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load JAMB questions" },
      { status: 500 }
    );
  }
}