/**
 * Text-to-Speech API Route
 * Converts text to speech using Groq TTS
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface TextToSpeechRequest {
  text: string;
  voice?: 'autumn' | 'diana' | 'hannah' | 'austin' | 'daniel' | 'troy';
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
        { error: 'Text-to-speech service not configured' },
        { status: 500 }
      );
    }

    const body = await request.json() as TextToSpeechRequest;
    const { text, voice = 'diana', language = 'en' } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Limit text length for TTS (typical API limits)
    if (text.length > 4096) {
      return NextResponse.json(
        { error: 'Text too long (max 4096 characters)' },
        { status: 400 }
      );
    }

    // Call Groq TTS API
    const groqResponse = await fetch(
      'https://api.groq.com/openai/v1/audio/speech',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'canopylabs/orpheus-v1-english', // Use available model
          input: text,
          voice: voice,
          response_format: 'wav',
        }),
      }
    );

    if (!groqResponse.ok) {
      const errorData = await groqResponse.text();
      console.error('Groq TTS API error:', groqResponse.status, errorData);
      return NextResponse.json(
        { error: 'Failed to generate speech', details: errorData },
        { status: groqResponse.status }
      );
    }

    // Get audio buffer
    const audioBuffer = await groqResponse.arrayBuffer();

    // Return audio as base64
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return NextResponse.json({
      success: true,
      audio: base64Audio,
      contentType: 'audio/wav',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate speech',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
