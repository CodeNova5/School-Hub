/**
 * Speech-to-Text API Route
 * Converts audio to text using Groq Whisper
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface SpeechToTextRequest {
  audio: string; // Base64 encoded audio data
  language?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.error('GROQ_API_KEY not configured');
      return NextResponse.json(
        { error: 'Speech-to-text service not configured' },
        { status: 500 }
      );
    }

    const body = await request.json() as SpeechToTextRequest;
    const { audio, language = 'en' } = body;

    if (!audio) {
      return NextResponse.json(
        { error: 'Audio data is required' },
        { status: 400 }
      );
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    const uint8Array = new Uint8Array(audioBuffer);

    // Create FormData for Groq API
    const formData = new FormData();
    const audioBlob = new Blob([uint8Array], { type: 'audio/wav' });
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', language);
    formData.append('response_format', 'json');

    // Call Groq Whisper API
    const groqResponse = await fetch(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: formData,
      }
    );

    if (!groqResponse.ok) {
      const errorData = await groqResponse.text();
      console.error('Groq API error:', groqResponse.status, errorData);
      return NextResponse.json(
        { error: 'Failed to transcribe audio', details: errorData },
        { status: groqResponse.status }
      );
    }

    const result = await groqResponse.json() as { text: string };

    return NextResponse.json({
      success: true,
      text: result.text,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in speech-to-text:', error);
    return NextResponse.json(
      {
        error: 'Failed to process speech',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
