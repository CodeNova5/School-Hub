# Speech Features - Integration Examples

## 1. Parent Portal with Speech Support

```tsx
// app/parent/ai-chat/page.tsx
'use client';

import { useState } from 'react';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Card } from '@/components/ui/card';

export default function ParentAIChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            AI Assistant
          </h1>
          <p className="text-gray-600">
            Ask questions about your child's school data. Use your voice or type.
          </p>
        </div>

        <Card className="h-[600px] overflow-hidden">
          <AIAssistantChat
            enableSpeech={true}
            autoPlayResponses={false}
            welcomeMessage="Hello! I'm your school AI assistant. You can ask me about your child's attendance, grades, or any school information. Feel free to use your voice!"
            sessionId={sessionId}
            onSessionIdChange={setSessionId}
            suggestedQuestions={[
              "What's my child's current attendance?",
              "Can you show me recent grades?",
              "What assignments are pending?",
              "Tell me about upcoming events",
            ]}
          />
        </Card>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">💡 Tips:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Click the 🎤 microphone button to ask via voice</li>
            <li>• Hover over responses to click 🔊 for audio playback</li>
            <li>• Your chat history is saved automatically</li>
            <li>• Ask follow-up questions naturally</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

## 2. Teacher Dashboard with AI Insights

```tsx
// app/teacher/ai-insights/page.tsx
'use client';

import { useState } from 'react';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TeacherAIInsightsPage() {
  const [selectedClass, setSelectedClass] = useState('class-a');

  const getTeacherQuestions = () => {
    const baseQuestions = [
      'Which students need attention in class?',
      'Show me performance trends',
      'Analyze attendance patterns',
      'What resources should I prepare?',
    ];
    // Can add class-specific questions based on selectedClass
    return baseQuestions;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">AI Classroom Insights</h1>
        <p className="text-gray-600">
          Get intelligent insights about your classes with voice support
        </p>
      </div>

      <Tabs value={selectedClass} onValueChange={setSelectedClass}>
        <TabsList>
          <TabsTrigger value="class-a">Class A</TabsTrigger>
          <TabsTrigger value="class-b">Class B</TabsTrigger>
          <TabsTrigger value="class-c">Class C</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedClass} className="border rounded-lg p-6 h-[600px]">
          <AIAssistantChat
            enableSpeech={true}
            autoPlayResponses={false}
            welcomeMessage={`AI Assistant for ${selectedClass.toUpperCase()}. Ask about student performance, attendance, or class insights.`}
            suggestedQuestions={getTeacherQuestions()}
            sessionId={`teacher-${selectedClass}`}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

## 3. Admin Management with Voice Commands

```tsx
// app/admin/ai-management/page.tsx
'use client';

import AIAssistantChat from '@/components/ai-assistant-chat';
import { useEffect, useState } from 'react';

export default function AdminManagementPage() {
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  useEffect(() => {
    // Check if admin has speech access enabled
    // This could be a user setting or role-based feature
    setIsLoadingPermissions(false);
  }, []);

  if (isLoadingPermissions) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Sidebar with school stats */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">School Stats</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Students:</span>
              <span className="font-bold">2,456</span>
            </div>
            <div className="flex justify-between">
              <span>Active Classes:</span>
              <span className="font-bold">48</span>
            </div>
            <div className="flex justify-between">
              <span>Teachers:</span>
              <span className="font-bold">125</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main AI Chat */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-lg shadow h-[600px] overflow-hidden">
          <AIAssistantChat
            enableSpeech={true}
            autoPlayResponses={false}
            welcomeMessage="Admin AI Assistant. Ask about school-wide metrics, reports, or management tasks."
            suggestedQuestions={[
              'Generate attendance report',
              'Show promotion statistics',
              'List pending results',
              'Performance analysis',
              'Create new semester schedule',
              'User management report',
            ]}
          />
        </div>
      </div>

      {/* Activity Log */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-lg p-4 shadow">
          <h3 className="font-semibold mb-3">Recent AI Queries</h3>
          <div className="text-sm text-gray-600">
            All voice queries are logged for audit purposes
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 4. Student Learning Assistant

```tsx
// app/student/ai-tutor/page.tsx
'use client';

import { useState } from 'react';
import AIAssistantChat from '@/components/ai-assistant-chat';

export default function StudentTutorPage() {
  const [subject, setSubject] = useState('all');

  const getSubjectQuestions = () => {
    const questions: Record<string, string[]> = {
      math: [
        'Explain quadratic equations',
        'Help with algebra',
        'Show geometry examples',
      ],
      english: [
        'Analyze this poem',
        'Grammar tips',
        'Essay writing help',
      ],
      science: [
        'Explain the water cycle',
        'Physics concepts',
        'Chemistry reactions',
      ],
      all: [
        'What topics should I study?',
        'Show my assignment schedule',
        'Explain difficult concepts',
        'Practice quizzes available',
      ],
    };
    return questions[subject] || questions.all;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📚 AI Learning Tutor
          </h1>
          <p className="text-gray-600">
            Your personal study assistant - ask questions, get explanations, and track progress
          </p>
        </div>

        {/* Subject Selector */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {['all', 'math', 'english', 'science'].map((subj) => (
            <button
              key={subj}
              onClick={() => setSubject(subj)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                subject === subj
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {subj.charAt(0).toUpperCase() + subj.slice(1)}
            </button>
          ))}
        </div>

        {/* Main Chat */}
        <div className="bg-white rounded-xl shadow-lg h-[600px] overflow-hidden">
          <AIAssistantChat
            enableSpeech={true}
            autoPlayResponses={true}  // Auto-play responses for learning
            welcomeMessage={`Hello! I'm your AI tutor. Ask me anything about ${
              subject === 'all' ? 'any subject' : subject
            }. I can explain concepts, help with homework, and answer questions.`}
            suggestedQuestions={getSubjectQuestions()}
            sessionId={`student-${subject}`}
          />
        </div>

        {/* Learning Tips */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-2xl mb-2">🎤</div>
            <h3 className="font-semibold mb-1">Voice Questions</h3>
            <p className="text-sm text-gray-600">Ask questions using your voice for faster interaction</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-2xl mb-2">🔊</div>
            <h3 className="font-semibold mb-1">Listen & Learn</h3>
            <p className="text-sm text-gray-600">Hear explanations read aloud for better retention</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow">
            <div className="text-2xl mb-2">💾</div>
            <h3 className="font-semibold mb-1">Save Sessions</h3>
            <p className="text-sm text-gray-600">All your chat history is automatically saved</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 5. Custom Hook for Voice Input

```tsx
// hooks/useVoiceInput.ts
'use client';

import { useState, useCallback } from 'react';
import { recordAudio, playAudio } from '@/lib/audio-utils';

export function useVoiceInput() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setIsRecording(true);
      // Recording will start
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Recording failed';
      setError(message);
      setIsRecording(false);
    }
  }, []);

  const stopAndTranscribe = useCallback(
    async (maxDuration = 30000) => {
      try {
        setIsRecording(false);
        setIsTranscribing(true);
        const audioBase64 = await recordAudio(maxDuration);

        const response = await fetch('/api/ai-assistant/speech-to-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: audioBase64 }),
        });

        if (!response.ok) throw new Error('Transcription failed');

        const { text } = await response.json();
        return text;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transcription failed';
        setError(message);
        return null;
      } finally {
        setIsTranscribing(false);
      }
    },
    []
  );

  const playResponse = useCallback(async (text: string) => {
    try {
      setError(null);
      setIsPlaying(true);

      const response = await fetch('/api/ai-assistant/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error('Speech generation failed');

      const { audio } = await response.json();
      await playAudio(audio);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Playback failed';
      setError(message);
    } finally {
      setIsPlaying(false);
    }
  }, []);

  return {
    isRecording,
    isTranscribing,
    isPlaying,
    error,
    startRecording,
    stopAndTranscribe,
    playResponse,
  };
}

// Usage in component:
// const { startRecording, stopAndTranscribe, isRecording } = useVoiceInput();
```

## 6. Mobile-Optimized Version

```tsx
// app/student/mobile-chat/page.tsx
'use client';

import AIAssistantChat from '@/components/ai-assistant-chat';

export default function MobileAIChatPage() {
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 shadow">
        <h1 className="text-xl font-bold">Math Tutor</h1>
        <p className="text-sm opacity-90">Ask questions anytime</p>
      </div>

      {/* Chat Area - takes full remaining space */}
      <div className="flex-1 overflow-hidden">
        <AIAssistantChat
          enableSpeech={true}
          autoPlayResponses={false}
          welcomeMessage="Hi! What math topic do you need help with today?"
          suggestedQuestions={[
            'Explain fractions',
            'Add two-digit numbers',
            'What is multiplication?',
            'Show me examples',
          ]}
        />
      </div>
    </div>
  );
}
```

## 7. With Redux/State Management

```tsx
// store/aiAssistantSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantState {
  messages: Message[];
  currentSessionId: string | null;
  isRecording: boolean;
  isLoading: boolean;
}

const initialState: AIAssistantState = {
  messages: [],
  currentSessionId: null,
  isRecording: false,
  isLoading: false,
};

const aiAssistantSlice = createSlice({
  name: 'aiAssistant',
  initialState,
  reducers: {
    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload;
    },
    setSessionId: (state, action: PayloadAction<string | null>) => {
      state.currentSessionId = action.payload;
    },
    setRecording: (state, action: PayloadAction<boolean>) => {
      state.isRecording = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setMessages, setSessionId, setRecording, setLoading } =
  aiAssistantSlice.actions;

export default aiAssistantSlice.reducer;
```

## Integration Tips

1. **Performance:** Memoize component props that don't change
2. **Accessibility:** Add aria-labels to mic/speaker buttons
3. **Analytics:** Track speech interactions separately
4. **Error Boundaries:** Wrap AI chat in error boundary
5. **Testing:** Mock speech API for unit tests
6. **Caching:** Store transcriptions for repeated queries
7. **Rate Limiting:** Implement backoff for API errors

## Next Steps

1. Choose integration pattern that fits your needs
2. Test thoroughly in target environment
3. Gather user feedback
4. Optimize based on usage patterns
5. Monitor costs on Groq console
