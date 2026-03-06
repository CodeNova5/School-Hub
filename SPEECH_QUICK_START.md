# Speech Features - Quick Start Checklist ✅

## Pre-Deployment Setup (5 minutes)

- [ ] **Step 1: Get Groq API Key**
  - Go to https://console.groq.com
  - Sign up or log in
  - Navigate to **API Keys**
  - Click **Create API Key**
  - Copy the key

- [ ] **Step 2: Add Environment Variable**
  - Open `.env.local` in your project root
  - Add: `GROQ_API_KEY=your_api_key_here`
  - Save the file
  - Restart dev server: `npm run dev`

- [ ] **Step 3: Test Microphone**
  - Open your app in browser
  - Click the **mic icon** in AI assistant
  - Accept microphone permission
  - Speak a few words: "How many students are in class A?"
  - Click **Stop**
  - Verify transcription appears in input box

- [ ] **Step 4: Test Audio Playback**
  - Ask the AI assistant a question
  - Hover over the AI response
  - Click the **speaker icon**
  - Verify you hear the response

## Component Integration (3 minutes)

### Basic Usage

```tsx
import AIAssistantChat from '@/components/ai-assistant-chat';

export default function YourPage() {
  return (
    <AIAssistantChat
      enableSpeech={true}           // Enable mic/speaker
      autoPlayResponses={false}      // Don't auto-play responses
      welcomeMessage="Hi! Ask me anything or use your mic."
      suggestedQuestions={[
        "How many students are here?",
        "Tell me about grades",
        "Show attendance stats"
      ]}
    />
  );
}
```

### With Session Control

```tsx
const [sessionId, setSessionId] = useState<string | null>(null);

<AIAssistantChat
  enableSpeech={true}
  sessionId={sessionId}
  onSessionIdChange={setSessionId}
  onMessagesUpdate={(messages) => {
    console.log('Chat updated:', messages);
  }}
/>
```

## Key Features Implemented

### ✨ Speech-to-Text (Groq Whisper)
- Click **mic button** to start recording
- Records up to 30 seconds max
- Real-time timer (MM:SS format)
- Automatic transcription on stop
- Supports 99+ languages
- **API Endpoint:** `POST /api/ai-assistant/speech-to-text`

### 🔊 Text-to-Speech (Groq TTS)
- Hover over AI response → Click **speaker icon**
- 6 different voices available: alloy, echo, fable, onyx, nova, shimmer
- Smooth audio playback
- Non-blocking (chat continues while playing)
- **API Endpoint:** `POST /api/ai-assistant/text-to-speech`

### 🎨 UX Improvements
- Red pulsing dot during recording
- Recording timer display
- Volume/speaker icon on hover
- Loading spinner for audio generation
- Graceful error handling
- Full resource cleanup

### 🔒 Security & Privacy
- All endpoints require authentication
- Audio not stored locally
- HTTPS encryption
- User-level data access control

## Files Created/Modified

```
NEW:
├── app/api/ai-assistant/speech-to-text/route.ts    (103 lines)
├── app/api/ai-assistant/text-to-speech/route.ts    (92 lines)
├── lib/audio-utils.ts                               (202 lines)
└── SPEECH_FEATURES_GUIDE.md                         (Comprehensive docs)

UPDATED:
└── components/ai-assistant-chat.tsx                 (~150 lines added)
    - Added speech state management
    - Integrated recording UI
    - Added audio playback buttons
    - Enhanced input controls
    - Improved accessibility
```

## Testing Checklist

### Browser Testing
- [ ] Chrome/Brave - Test recording and playback
- [ ] Firefox - Verify microphone works
- [ ] Safari/Edge - Check audio playback
- [ ] Incognito mode - Test permission flows

### Functionality Testing
- [ ] **Recording:**
  - [ ] Mic button shows correct state (active/inactive)
  - [ ] Timer counts up correctly
  - [ ] Stop button stops recording
  - [ ] Transcription appears in input

- [ ] **Playback:**
  - [ ] Speaker icon visible on hover
  - [ ] Audio plays without errors
  - [ ] Volume level is appropriate
  - [ ] Can interrupt playback

- [ ] **Error Handling:**
  - [ ] No microphone → Falls back to text input
  - [ ] API down → User sees error message
  - [ ] Network error → Graceful error handling
  - [ ] Invalid audio → Appropriate error

### Performance Testing
- [ ] Recording latency < 1s
- [ ] Transcription completes within 5s
- [ ] Audio generation < 3s
- [ ] No memory leaks on unmount
- [ ] Handles rapid clicks gracefully

## Environment Variables

```env
# Required for speech features
GROQ_API_KEY=gsk_your_key_here

# Optional (already configured)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
# ... other existing vars
```

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Mic button grayed out | Check browser permissions, restart browser |
| No transcription | Verify GROQ_API_KEY, check API console |
| No audio playback | Check volume, test speakers, try different browser |
| API 401 errors | Verify authentication, check user session |
| Recording doesn't start | Reload page, check permissions, test mic |

## Cost Estimate (Monthly)

Assuming 1,000 active users with 5 voice interactions/day:
- **Whisper (STT):** ~$100/month
- **TTS:** ~$50-75/month
- **Total:** ~$150-175/month

## Next Steps

1. ✅ Set GROQ_API_KEY in .env.local
2. ✅ Restart dev server
3. ✅ Test recording/playback
4. ✅ Monitor API usage in Groq console
5. ✅ Customize voices as needed
6. ✅ Deploy to production
7. ✅ Track performance metrics

## Documentation References

- **Full Setup Guide:** See `SPEECH_FEATURES_GUIDE.md`
- **Groq API Docs:** https://console.groq.com/docs
- **Audio Utilities:** See `lib/audio-utils.ts` for available functions
- **Component Props:** Check `AIAssistantChatProps` in component file

## Support & Troubleshooting

1. **Check Browser Console** (F12 → Console)
   - Look for error messages
   - Check API response codes

2. **Verify API Configuration**
   - Confirm GROQ_API_KEY is set
   - Check it's valid and not expired
   - Verify API rate limits not exceeded

3. **Test Individual Endpoints**
   ```bash
   # Test recording endpoint
   curl -X POST http://localhost:3000/api/ai-assistant/speech-to-text \
     -H "Content-Type: application/json" \
     -d '{"audio":"base64_audio_here"}'
   ```

4. **Monitor Groq Console**
   - Check usage stats
   - Review error logs
   - Verify quota limits

## Performance Optimization Tips

- Cache frequently asked questions with pre-recorded responses
- Use lower bitrate audio recording (WebM opus)
- Implement response debouncing for rapid queries
- Consider batch processing for multiple users
- Monitor API latency metrics

## Ready to Deploy! 🚀

Once you've completed the checklist:
1. Test in production environment
2. Monitor API costs and usage
3. Track user engagement metrics
4. Gather user feedback
5. Iterate on voice selections/quality

For questions, refer to the full `SPEECH_FEATURES_GUIDE.md`
