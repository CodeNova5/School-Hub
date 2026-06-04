import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext } from '@/lib/teacher-question-bank/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const QUESTION_IMAGE_BUCKET = process.env.TEACHER_QUESTION_IMAGE_BUCKET || 'teacher-question-images';

type QuestionImageMetadata = {
  imageUrl: string;
  imagePath: string;
  imageName: string;
  imageMimeType: string;
  imageSize: number;
};

function toCleanStringList(value: unknown) {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function sanitizeFileName(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'question-image'
  );
}

function inferExtension(file: File) {
  const fromName = file.name.split('.').pop()?.trim().toLowerCase();
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }

  const fromType = file.type.toLowerCase();
  if (fromType.includes('jpeg')) return 'jpg';
  if (fromType.includes('png')) return 'png';
  if (fromType.includes('webp')) return 'webp';
  if (fromType.includes('gif')) return 'gif';
  if (fromType.includes('avif')) return 'avif';

  return 'jpg';
}

async function ensureBucketExists(supabaseAdmin: any, bucketName: string) {
  const { data, error } = await supabaseAdmin.storage.listBuckets();

  if (error) {
    throw new Error(`Unable to list Supabase buckets: ${error.message}`);
  }

  if ((data || []).some((bucket: { name?: string }) => bucket.name === bucketName)) {
    return;
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
    public: true,
  });

  if (createError) {
    throw new Error(`Unable to create Supabase bucket \"${bucketName}\": ${createError.message}`);
  }
}

async function uploadQuestionImage(
  schoolId: string,
  bankId: string,
  teacherId: string,
  file: File
): Promise<QuestionImageMetadata> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    throw new Error('Supabase storage is not configured');
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are supported');
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error('Image must be 10MB or smaller');
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  await ensureBucketExists(supabaseAdmin, QUESTION_IMAGE_BUCKET);

  const safeName = sanitizeFileName(file.name).replace(/\.[^.]+$/, '');
  const extension = inferExtension(file);
  const objectPath = [
    'teacher-question-banks',
    schoolId,
    bankId,
    teacherId,
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}.${extension}`,
  ].join('/');

  const { error: uploadError } = await supabaseAdmin.storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(objectPath, await file.arrayBuffer(), {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicData } = supabaseAdmin.storage.from(QUESTION_IMAGE_BUCKET).getPublicUrl(objectPath);

  return {
    imageUrl: publicData.publicUrl,
    imagePath: objectPath,
    imageName: file.name,
    imageMimeType: file.type,
    imageSize: file.size,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { bankId: string } }
) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;
  const bankId = params.bankId;

  const { data: bank, error: bankError } = await supabase
    .from('teacher_question_banks')
    .select('id, title, visibility, created_by_teacher_id, subject_class_id')
    .eq('id', bankId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (bankError) {
    return NextResponse.json({ error: bankError.message }, { status: 400 });
  }

  if (!bank) {
    return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
  }

  if (bank.created_by_teacher_id !== teacherId && bank.visibility !== 'public_school') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const difficulty = url.searchParams.get('difficulty');
  const questionType = url.searchParams.get('questionType');
  const search = url.searchParams.get('search');

  let query = supabase
    .from('teacher_questions')
    .select(`
      id,
      topic,
      question_text,
      options,
      correct_answer,
      explanation,
      metadata,
      question_type,
      difficulty,
      visibility,
      created_by_teacher_id,
      source_question_id,
      created_at,
      updated_at
    `)
    .eq('bank_id', bankId)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (difficulty) {
    query = query.eq('difficulty', difficulty);
  }

  if (questionType) {
    query = query.eq('question_type', questionType);
  }

  if (search) {
    query = query.ilike('question_text', `%${search}%`);
  }

  const { data: questions, error: questionsError } = await query;
  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 400 });
  }

  return NextResponse.json({ bank, questions: questions || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { bankId: string } }
) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;
  const bankId = params.bankId;

  const { data: bank, error: bankError } = await supabase
    .from('teacher_question_banks')
    .select('id, created_by_teacher_id, subject_class_id, visibility')
    .eq('id', bankId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (bankError) {
    return NextResponse.json({ error: bankError.message }, { status: 400 });
  }

  if (!bank) {
    return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
  }

  if (bank.created_by_teacher_id !== teacherId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    let body: Record<string, unknown> = {};
    let imageFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries());
      const candidate = form.get('imageFile');
      imageFile = candidate instanceof File && candidate.size > 0 ? candidate : null;
    } else {
      body = await request.json();
    }

    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const questionText = typeof body.questionText === 'string' ? body.questionText.trim() : '';
    const questionType = body.questionType === 'theory' ? 'theory' : 'objective';
    const difficulty = ['easy', 'medium', 'hard'].includes(String(body.difficulty)) ? String(body.difficulty) : 'medium';
    const visibility = body.visibility === 'public_school' ? 'public_school' : 'private';
    const explanation = typeof body.explanation === 'string' ? body.explanation.trim() : '';
    const correctAnswer = typeof body.correctAnswer === 'string' ? body.correctAnswer.trim() : '';
    const options = toCleanStringList(body.options);

    if (!topic || !questionText) {
      return NextResponse.json({ error: 'topic and questionText are required' }, { status: 400 });
    }

    const questionImage = imageFile ? await uploadQuestionImage(schoolId, bankId, teacherId, imageFile) : null;

    if (questionType === 'objective') {
      if (options.length < 2) {
        return NextResponse.json({ error: 'Objective questions need at least two options' }, { status: 400 });
      }

      if (!correctAnswer) {
        return NextResponse.json({ error: 'Objective questions need a correctAnswer (option letter A/B/C... or the option text)' }, { status: 400 });
      }

      // Resolve correctAnswer to an option letter (A, B, C, ...). Accept either a single-letter (A-D)
      // or the option text. Store the letter in the DB.
      const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      let correctAnswerLetter: string | null = null;
      const candidate = correctAnswer.trim();

      if (/^[A-H]$/i.test(candidate)) {
        const idx = LETTERS.indexOf(candidate.toUpperCase());
        if (idx >= 0 && idx < options.length) {
          correctAnswerLetter = LETTERS[idx];
        }
      }

      if (!correctAnswerLetter) {
        // try exact match against option text
        const idx = options.findIndex((opt) => opt.toLowerCase() === candidate.toLowerCase());
        if (idx >= 0) correctAnswerLetter = LETTERS[idx];
      }

      if (!correctAnswerLetter) {
        // try partial match (contains)
        const idx2 = options.findIndex((opt) => opt.toLowerCase().includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(opt.toLowerCase()));
        if (idx2 >= 0) correctAnswerLetter = LETTERS[idx2];
      }

      if (!correctAnswerLetter) {
        return NextResponse.json({ error: 'correctAnswer must match one of the options or be a valid option letter (A/B/C...)' }, { status: 400 });
      }

      // replace correctAnswer with letter for storage
      // (we keep `correctAnswer` variable for compatibility but use `correctAnswerLetter` below)
    }

    const { data, error } = await supabase
      .from('teacher_questions')
      .insert({
        school_id: schoolId,
        bank_id: bankId,
        subject_class_id: bank.subject_class_id,
        created_by_teacher_id: teacherId,
        question_type: questionType,
        difficulty,
        visibility,
        topic,
        question_text: questionText,
        options: questionType === 'objective' ? options : [],
        correct_answer: questionType === 'objective' ? (function(){
          // derive stored letter from provided correctAnswer / options
          const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          const candidate = (typeof body?.correctAnswer === 'string' ? body.correctAnswer.trim() : '');
          let correctAnswerLetter: string | null = null;

          if (candidate && /^[A-H]$/i.test(candidate)) {
            const idx = LETTERS.indexOf(candidate.toUpperCase());
            if (idx >= 0 && idx < options.length) correctAnswerLetter = LETTERS[idx];
          }

          if (!correctAnswerLetter && candidate) {
            const idx = options.findIndex((opt) => opt.toLowerCase() === candidate.toLowerCase());
            if (idx >= 0) correctAnswerLetter = LETTERS[idx];
          }

          if (!correctAnswerLetter && candidate) {
            const idx2 = options.findIndex((opt) => opt.toLowerCase().includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(opt.toLowerCase()));
            if (idx2 >= 0) correctAnswerLetter = LETTERS[idx2];
          }

          return correctAnswerLetter || null;
        })() : null,
        explanation: explanation || null,
        metadata: {
          createdVia: 'manual',
          ...(questionImage
            ? {
                imageUrl: questionImage.imageUrl,
                imagePath: questionImage.imagePath,
                imageName: questionImage.imageName,
                imageMimeType: questionImage.imageMimeType,
                imageSize: questionImage.imageSize,
              }
            : {}),
        },
      })
      .select(`
        id,
        topic,
        question_text,
        options,
        correct_answer,
        explanation,
        metadata,
        question_type,
        difficulty,
        visibility,
        created_by_teacher_id,
        source_question_id,
        created_at,
        updated_at
      `)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Failed to create question' }, { status: 400 });
    }

    return NextResponse.json({ question: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
