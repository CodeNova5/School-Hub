# 🎤 Speech Features - Visual UI Guide

## What Users Will See

### 1. **Initial Chat Interface** (Without Recording)

```
┌─────────────────────────────────────────────────────────┐
│  AI Assistant                                           │
│  Hi! I'm your AI assistant. Ask me anything about      │
│  students, classes, grades, teachers, and more!        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  💡 Try asking:                                         │
│  ┌────────────────────────────────────────────────┐   │
│  │ How many students are in class A?             │   │
│  ├────────────────────────────────────────────────┤   │
│  │ Show me the top 5 students by grade           │   │
│  ├────────────────────────────────────────────────┤   │
│  │ What's the current attendance rate?           │   │
│  ├────────────────────────────────────────────────┤   │
│  │ List all pending assignments                  │   │
│  └────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [🎤] [Type your question here...] [Send ➤]          │
└─────────────────────────────────────────────────────────┘
```

### 2. **While Recording**

```
┌─────────────────────────────────────────────────────────┐
│  🔴 Recording...  00:12                                │
│  [Stop Recording]                                       │
│                                                         │
│  (Red pulsing dot indicates active recording)          │
├─────────────────────────────────────────────────────────┤
│  [🔴 Stop Recording]                                   │
│  [Type your question here...] [Send ➤]               │
└─────────────────────────────────────────────────────────┘
```

### 3. **User Question Displayed**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                          "How many students in        │
│                           class A?"  10:30 AM          │
│                                                    [👤] │
│                                                         │
│  [🤖] "There are 45 students in class A. They       │
│       include 24 boys and 21 girls. Their            │
│       average age is 14 years old. Would you         │
│       like to know more details?"         [🔊] [📋] │
│       10:31 AM                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [🎤] [Type your question here...] [Send ➤]          │
└─────────────────────────────────────────────────────────┘
```

### 4. **Hover Over Response - Audio Button**

```
                                  [Volume Icon appears on hover]
  [🤖] "There are 45 students in class A..." [🔊] [📋]
                                                    ↑
                                        Click to play audio
```

### 5. **During Audio Generation**

```
  [🤖] "There are 45 students in class A..."   [⏳] [📋]
                                                ↑
                                    Loading spinner shows
```

### 6. **Recording Permission Screen**

```
┌─────────────────────────────────────────────────────────┐
│  Browser Permission Dialog                              │
│                                                         │
│  "School Hub" would like to access your microphone     │
│                                                         │
│  [Allow]  [Block]                                      │
│                                                         │
│  🔒 Your audio is only used for transcription          │
│     and is not stored locally.                         │
└─────────────────────────────────────────────────────────┘
```

### 7. **Full Conversation Example**

```
┌─────────────────────────────────────────────────────────┐
│  AI Assistant Chat                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Assistant: "Hi! I'm your AI assistant..."             │
│  10:00 AM                                              │
│                                                         │
│  You: "Show me top students"                      [👤] │
│  10:02 AM                                               │
│                                                         │
│  Assistant: "The top 5 students are...      [🔊] [📋] │
│  1. Sarah - 95%                                        │
│  2. Ahmed - 93%                                        │
│  3. Lisa - 92%                                         │
│  4. James - 91%                                        │
│  5. Emma - 90%"                                        │
│  10:03 AM                                              │
│                                                         │
│  You: "Details on Sarah"                          [👤] │
│  10:04 AM                                               │
│                                                         │
│  Assistant: "Sarah has excellent grades...   [🔊] [📋] │
│  She scored 95% and shows consistent                   │
│  performance across all subjects."                      │
│  10:04 AM                                              │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [🎤] [Ask a follow-up question...] [Send ➤]         │
│  Timer: 00:00                                          │
└─────────────────────────────────────────────────────────┘
```

### 8. **Mobile View**

```
┌─────────────────────────────────────┐
│  AI Chat             🎤 ℹ️           │
├─────────────────────────────────────┤
│                                     │
│  Hi! Ask me anything!               │
│  10:00                              │
│                                     │
│                    "Show grades" 👤 │
│                         10:02       │
│                                     │
│  "Top students are... 🤖            │
│  1. Sarah - 95%                     │
│  2. Ahmed - 93%"                    │
│                       [🔊] [📋]    │
│           10:03                     │
│                                     │
├─────────────────────────────────────┤
│  [🎤]                             │
│  Ask a question...          [➤]   │
│                                     │
└─────────────────────────────────────┘
```

## Button States & Indicators

### Microphone Button States

```
Default (Not Recording):        Recording:
┌──────────┐                    ┌──────────┐
│   🎤     │                    │   🔴     │
│          │                    │  Rec...  │
└──────────┘                    └──────────┘
Click to   →→                   Stop button
record                          visible
```

### Speaker Button States

```
Ready to Play:              Playing:                Error:
┌──────────┐               ┌──────────┐           ┌──────────┐
│  [🔊]    │               │  [⏳]    │           │  [❌]    │
│ Click to │               │ Playing  │           │ Failed   │
│  play    │               │ audio    │           │          │
└──────────┘               └──────────┘           └──────────┘
```

### Copy Button State

```
Default:                    Copied (2 sec):
┌──────────┐               ┌──────────┐
│  [📋]    │    →→→→       │  [✓]     │
│ Copy     │    Copy!      │ Copied!  │
└──────────┘               └──────────┘
                           (Returns to default after 2s)
```

## Recording Timer Display

```
[🔴] Recording...  00:00  ← Timer counts up
[🔴] Recording...  00:05
[🔴] Recording...  00:12
[🔴] Recording...  00:25
[🔴] Recording...  00:30  ← Max reached, auto-stops
```

## Error States

### Microphone Error
```
┌─────────────────────────────────────┐
│  ⚠️  Failed to access microphone    │
│                                     │
│  Please check your browser          │
│  permissions and try again.         │
│                                     │
│  [Retry]                            │
└─────────────────────────────────────┘
```

### API Error
```
┌─────────────────────────────────────┐
│  ❌ Failed to transcribe audio      │
│                                     │
│  This could be a speech API issue.  │
│  Please try again.                  │
│                                     │
│  [Retry] [Use Text Instead]         │
└─────────────────────────────────────┘
```

### TTS Error
```
┌─────────────────────────────────────┐
│  ⚠️  Could not generate audio       │
│                                     │
│  Please try a different browser     │
│  or check your internet connection. │
│                                     │
│  [OK]                               │
└─────────────────────────────────────┘
```

## Color Scheme

### Light Theme (Current)
- **Recording Indicator:** Red (#EF4444)
- **Microphone Active:** Red pulsing
- **Speaker Ready:** Emerald Green (#10B981)
- **Loading:** Blue spinner (#3B82F6)
- **Success:** Green checkmark (#10B981)
- **Error:** Red/Orange (#EF4444 or #F97316)
- **Chat Background:** Slate gray (#0F172A to #1E293B)

### Accessibility

```
Keyboard Navigation:
- Tab: Cycle through buttons
- Enter: Click focused button
- Shift+Enter: New line in text field
- Alt+M: Focus microphone button
- Alt+S: Focus send button

Screen Reader:
- "Microphone button, press to record"
- "Recording 00:12 seconds"
- "Stop recording button, press to stop"
- "Play audio response button"
- "Copy response button"
- "Query information button"
```

## Responsive Breakpoints

```
Mobile (<640px):
- Full width input
- Mic button on left
- Send button on right
- Speaker icon visible on tap/long-press
- Larger touch targets (44x44px minimum)

Tablet (640px-1024px):
- Optimal width 90%
- All buttons clearly visible
- Suggested questions in 2-column grid

Desktop (>1024px):
- Max width 800px
- Comfortable spacing
- Suggested questions in 4-column grid
- Smooth hover effects
```

## Animation Details

### Recording Pulse
```
Animation: Pulsing red dot during recording
Duration: 1 second per pulse
Effect: opacity 1 → 0.3 → 1
Color: #EF4444 (red)
```

### Loading Spinner
```
Animation: 3 bouncing dots
Duration: 400ms per bounce
Delays: 0ms, 150ms, 300ms
Color: Varies by context (blue for send, emerald for assistant)
```

### Auto-scroll
```
Behavior: Smooth scroll to newest message
Trigger: New message arrives
Duration: 300ms
Effect: Bottom of chat always visible
```

## Notification Toasts (Future Addition)

```
Success Toast:
┌─────────────────────────────────┐
│ ✓ Message sent!                 │
└─────────────────────────────────┘

Error Toast:
┌─────────────────────────────────┐
│ ✗ Failed to send. Try again.    │
└─────────────────────────────────┘

Info Toast:
┌─────────────────────────────────┐
│ ℹ Microphone access required    │
└─────────────────────────────────┘
```

## Query Information Panel

```
Hidden by default. Click "Query Info" to expand:

┌─────────────────────────────────────────┐
│ Query Information                       │
├─────────────────────────────────────────┤
│                                         │
│ Explanation: Finding top 5 students   │
│ by grade...                             │
│                                         │
│ Tables: students, grades, classes      │
│                                         │
│ Results: 5 records found                │
│                                         │
│ [Close]                                 │
└─────────────────────────────────────────┘
```

---

## User Journey Flow

```
START
  ↓
[See AI Chat Interface]
  ↓
User chooses:
├─→ Type a question
│   ├─→ Fill input field
│   └─→ Click Send
│       └─→ AI responds
│
└─→ Use microphone
    ├─→ Click Mic button
    ├─→ Grant permission (first time)
    ├─→ Speak clearly
    ├─→ Recording timer shows
    ├─→ Click Stop
    ├─→ Transcription appears
    ├─→ Auto-send (optional)
    └─→ AI responds
        ├─→ Hover over response
        ├─→ See speaker icon
        ├─→ Click to play audio
        └─→ Hear response
            ↓
        [Continue conversation]
        ↓
        END
```

---

**Next: Implement the component with your Groq API key!**
