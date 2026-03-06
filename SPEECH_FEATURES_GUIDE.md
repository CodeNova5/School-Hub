# AI Assistant Speech Features - Complete Setup Guide

## Overview

Your AI Assistant now supports advanced speech capabilities powered by Groq AI:
- **Speech-to-Text**: Groq Whisper for accurate audio transcription
- **Text-to-Speech**: Groq TTS for natural voice responses
- **Excellent UX**: Visual feedback, recording timer, and smooth audio playback

## Setup Instructions

### 1. Environment Configuration

Add your Groq API key to `.env.local`:

```env
# Groq API Configuration
GROQ_API_KEY=your_groq_api_key_here
```

**Get your Groq API key:**
1. Visit [console.groq.com](https://console.groq.com)
2. Sign up or log in
3. Go to **API Keys**
4. Click **Create API Key**
5. Copy and paste into `.env.local`

### 2. Component Usage

#### Basic Implementation

```tsx
import AIAssistantChat from '@/components/ai-assistant-chat';

export default function Page() {
  return (
    <AIAssistantChat
      enableSpeech={true}
      autoPlayResponses={false}
      welcomeMessage="Hi! You can type or use your mic to ask questions."
      suggestedQuestions={[
        "Tell me about top students",
        "What's the latest attendance?",
        "Show me class results"
      ]}
    />
  );
}
```

#### Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `enableSpeech` | boolean | `true` | Enable microphone and audio features |
| `autoPlayResponses` | boolean | `false` | Auto-play AI responses as audio |
| `welcomeMessage` | string | Default message | Initial greeting text |
| `placeholder` | string | "Ask a question..." | Input field placeholder |
| `suggestedQuestions` | string[] | `[]` | Quick question suggestions |
| `onMessagesUpdate` | function | undefined | Callback when messages update |
| `sessionId` | string | undefined | Load specific chat session |
| `onSessionIdChange` | function | undefined | Callback when session changes |

### 3. API Endpoints

#### Speech-to-Text (Groq Whisper)

**Endpoint:** `POST /api/ai-assistant/speech-to-text`

**Request:**
```json
{
  "audio": "base64_encoded_audio_data",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "text": "transcribed text here",
  "timestamp": "2026-03-06T10:30:00Z"
}
```

#### Text-to-Speech (Groq TTS)

**Endpoint:** `POST /api/ai-assistant/text-to-speech`

**Request:**
```json
{
  "text": "The text to convert to speech",
  "voice": "nova",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "audio": "base64_encoded_audio_data",
  "contentType": "audio/mpeg",
  "timestamp": "2026-03-06T10:30:00Z"
}
```

**Available Voices:** `alloy`, `echo`, `fable`, `onyx`, `nova` (default), `shimmer`

### 4. Audio Utility Functions

Use the audio utilities from `/lib/audio-utils.ts`:

```tsx
import {
  recordAudio,          // Record from microphone
  playAudio,            // Play base64 audio
  getMicrophoneStream,  // Get audio stream
  stopAudioStream,      // Stop recording
  formatDuration,       // Format time (MM:SS)
  checkMicrophonePermission, // Check mic permission
} from '@/lib/audio-utils';

// Example: Custom recording
const recordAndTranscribe = async () => {
  try {
    const audioBase64 = await recordAudio(30000); // 30 second limit
    // Send to API
  } catch (error) {
    console.error('Recording failed:', error);
  }
};
```

## Features & UX Details

### Microphone Recording

**Visual Feedback:**
- Red pulsing dot during recording
- Recording timer (MM:SS format)
- Stop button always visible while recording
- Automatic stream cleanup on component unmount

**Workflow:**
1. Click **mic button** → Requests microphone access
2. Starts recording with visual timer
3. Click **Stop** or auto-stops after 30 seconds
4. Audio transcribed via Groq Whisper
5. Transcription appears in input field
6. Auto-sends to AI

### Audio Playback

**Visual Feedback:**
- Volume icon appears on hover over assistant messages
- Shows spinner while generating speech
- One audio plays at a time
- Smooth auto-cleanup after playback

**Workflow:**
1. Hover over assistant response
2. Click **volume icon** → Sends text to Groq TTS
3. Audio plays automatically
4. Non-blocking (can continue chatting)

### Error Handling

**Graceful Degradation:**
- Component works without speech if Groq API is down
- Microphone permission denied → Falls back to text input only
- Network errors → User-friendly error messages
- Automatic stream cleanup prevents resource leaks

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Microphone Recording | ✅ 25+ | ✅ 25+ | ✅ 14.1+ | ✅ 79+ |
| Audio Playback | ✅ | ✅ | ✅ | ✅ |
| MediaRecorder API | ✅ | ✅ | ✅ 14.1+ | ✅ |

## Security & Permissions

### Required Permissions

1. **Microphone Access** - User must grant permission
2. **Network Access** - HTTPS required for getUserMedia() in production

### Privacy

- Audio is **NOT** stored on device (except in browser memory during recording)
- Transcriptions stored in Supabase chat history only
- Base64 audio sent to Groq API (encrypted over HTTPS)
- No audio files persist after playback

### Authentication

All endpoints require user authentication:
- Supabase session must be valid
- User role determines data access
- Returns 401 if not authenticated

## Troubleshooting

### Mic Permission Denied

**Problem:** Microphone button grayed out or not working

**Solution:**
1. Check browser permissions (address bar lock icon)
2. Reset permissions and revisit site
3. Try incognito/private mode
4. Check OS-level microphone permissions

### No Audio Output

**Problem:** Can't hear TTS responses

**Solution:**
1. Check browser volume (not muted)
2. Check system volume
3. Verify speakers are connected
4. Try different browser
5. Check developer console for errors

### Transcription Not Appearing

**Problem:** Recording doesn't produce text

**Solution:**
1. Verify GROQ_API_KEY is set
2. Check speaking clearly during recording
3. Verify microphone works (test in browser settings)
4. Check network tab in DevTools for API errors
5. Check API key hasn't expired

### API Not Responding

**Problem:** 500 errors from speech endpoints

**Solution:**
1. Verify GROQ_API_KEY in .env.local
2. Run `npm run dev` to reload environment vars
3. Check Groq API status (console.groq.com)
4. Check browser console for detailed error messages

## Performance Optimization

### Best Practices

1. **Mic Recording Limit**: Capped at 30 seconds to prevent abuse
2. **TTS Limit**: Max 4096 characters per request
3. **Audio Format**: WebM for recording (efficient compression)
4. **Playback**: WebM → MP3 conversion on backend
5. **Cleanup**: Automatic resource cleanup on unmount

### Reducing Latency

1. Use regional Groq API endpoints if available
2. Consider caching common responses
3. Pre-record common messages for TTS
4. Use shorter, clearer speech for STT

## Advanced Configuration

### Custom Voice Selection

Modify the `handlePlayResponse` function in `ai-assistant-chat.tsx`:

```tsx
const handlePlayResponse = async (messageId: string, content: string) => {
  const voice = 'echo'; // Change voice here
  // ... rest of function
};
```

### Custom Recording Duration

Change the recording timeout in `/lib/audio-utils.ts`:

```tsx
setTimeout(() => {
  recorder.stop();
  stopAudioStream(stream!);
}, 60000); // Change to 60 seconds
```

### Language Support

Groq Whisper supports 99+ languages:

```tsx
// In speech-to-text request
body: JSON.stringify({
  audio: audioBase64,
  language: "fr" // French, "es" for Spanish, etc.
})
```

## File Structure

```
app/
├── api/ai-assistant/
│   ├── speech-to-text/
│   │   └── route.ts          # Groq Whisper endpoint
│   ├── text-to-speech/
│   │   └── route.ts          # Groq TTS endpoint
│   ├── ask/
│   │   └── route.ts          # Main AI assistant
│   ├── history/
│   │   └── route.ts          # Chat history
│   └── save-message/
│       └── route.ts          # Save messages

components/
└── ai-assistant-chat.tsx     # Main UI component

lib/
└── audio-utils.ts            # Audio handling utilities
```

## Cost Estimation

### Groq Pricing (Approximate)

- **Whisper (STT)**: ~$1-2 per hour of audio
- **TTS**: ~$0.02-0.05 per 1M characters
- Each 30-second recording: ~$0.0001
- 1000 character response: ~$0.0001

**Monthly estimate** (1000 users, 5 interactions/day):
- ~$150-200/month with heavy speech usage

## Next Steps

1. ✅ Install Groq API key in `.env.local`
2. ✅ Test microphone recording in browser
3. ✅ Verify TTS audio playback
4. ✅ Monitor API usage in Groq console
5. ✅ Customize voices/languages as needed
6. ✅ Set up error monitoring in production

## Related Documentation

- [Groq API Docs](https://console.groq.com/docs)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [getUserMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

## Support

For issues:
1. Check browser console (F12 → Console tab)
2. Verify API key and permissions
3. Test with sample code snippets
4. Check Groq status page
5. Review error messages in network tab
