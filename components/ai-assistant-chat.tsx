/**
 * AI Assistant Chat Component
 * Provides a chat-like interface for asking questions about school data
 * Supports session-based chat history and memory preservation
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, AlertCircle, Info, Copy, Check, Mic, MicOff, Volume2, VolumeX, Pause, Play, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { recordAudio, playAudio, getMicrophoneStream, stopAudioStream, formatDuration, checkMicrophonePermission, speakText, stopSpeech } from '@/lib/audio-utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  queryInfo?: {
    explanation: string;
    tables: string[];
    resultCount?: number;
  };
  error?: boolean;
}

interface ErrorNotification {
  id: string;
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  duration?: number;
}

interface AIAssistantChatProps {
  welcomeMessage?: string;
  placeholder?: string;
  suggestedQuestions?: string[];
  initialMessages?: Message[];
  onMessagesUpdate?: (messages: Message[]) => void;
  sessionId?: string;
  onSessionIdChange?: (sessionId: string) => void;
  enableSpeech?: boolean;
  autoPlayResponses?: boolean;
  onGeneratedTitle?: (title: string) => void;
}

export default function AIAssistantChat({
  welcomeMessage = "Hi! I'm your AI assistant. Ask me anything about students, classes, grades, teachers, and more!",
  placeholder = "Ask a question about school data...",
  suggestedQuestions = [],
  initialMessages = [],
  onMessagesUpdate,
  sessionId: propSessionId,
  onSessionIdChange,
  enableSpeech = true,
  autoPlayResponses = false,
  onGeneratedTitle,
}: AIAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(propSessionId || null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [expandedQueryInfoId, setExpandedQueryInfoId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ErrorNotification[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Speech-related state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(enableSpeech);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt' | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Error notification handler
  const showError = (title: string, message: string, duration: number = 5000) => {
    const id = Date.now().toString();
    const notification: ErrorNotification = {
      id,
      title,
      message,
      type: 'error',
      duration,
    };

    setErrors((prev) => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        removeError(id);
      }, duration);
    }
  };

  const removeError = (id: string) => {
    setErrors((prev) => prev.filter((err) => err.id !== id));
  };
  // Load chat history on mount or when sessionId changes
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 2;

    const loadChatHistory = async () => {
      try {
        setIsLoadingHistory(true);
        
        // If sessionId is provided, load that specific session
        if (propSessionId) {
          const response = await fetch(`/api/ai-assistant/history?sessionId=${propSessionId}`);
          
          if (!isMounted) return;
          
          const data = await response.json();

          if (data.success && data.messages.length > 0) {
            setMessages(data.messages);
            setSessionId(propSessionId);
            if (onSessionIdChange) {
              onSessionIdChange(propSessionId);
            }
          } else {
            // Empty session, show welcome
            const welcomeMsg: Message = {
              id: '0',
              role: 'assistant',
              content: welcomeMessage,
              timestamp: new Date(),
            };
            setMessages([welcomeMsg]);
          }
        } else {
          // Load latest session (first time or no session specified)
          const response = await fetch('/api/ai-assistant/history');
          
          if (!isMounted) return;
          
          const data = await response.json();

          if (data.success && data.messages.length > 0) {
            setMessages(data.messages);
            setSessionId(data.sessionId);
            if (onSessionIdChange && data.sessionId) {
              onSessionIdChange(data.sessionId);
            }
          } else {
            // No history, show welcome message
            const welcomeMsg: Message = {
              id: '0',
              role: 'assistant',
              content: welcomeMessage,
              timestamp: new Date(),
            };
            setMessages([welcomeMsg]);
          }
        }
        retryCount = 0; // Reset on success
      } catch (error: any) {
        console.error('Error loading chat history:', error);
        
        if (!isMounted) return;
        
        // Don't retry on 429 rate limit
        if (error?.status === 429 || retryCount >= maxRetries) {
          console.warn('Max retries reached or rate limited');
          // Fallback to initial messages or welcome message
          if (initialMessages.length > 0) {
            setMessages(initialMessages);
          } else {
            const welcomeMsg: Message = {
              id: '0',
              role: 'assistant',
              content: welcomeMessage,
              timestamp: new Date(),
            };
            setMessages([welcomeMsg]);
          }
        } else {
          // Exponential backoff retry
          retryCount++;
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 5000);
          setTimeout(() => {
            if (isMounted) loadChatHistory();
          }, backoffDelay);
          return; // Don't call setIsLoadingHistory(false) yet
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadChatHistory();

    // Check microphone permission
    if (enableSpeech) {
      checkMicrophonePermission().then(setMicPermission).catch(() => {
        setMicPermission('prompt');
      });
    }

    return () => {
      isMounted = false;
    };
  }, [propSessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      // Stop recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Clear timeout
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }

      // Clear interval
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      // Stop stream
      if (mediaStreamRef.current) {
        stopAudioStream(mediaStreamRef.current);
      }

      // Stop any ongoing speech
      stopSpeech();
    };
  }, []);

  // Update recording time
  useEffect(() => {
    if (!isRecording) return;

    recordingIntervalRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  // Handle starting voice input
  const handleStartRecording = async () => {
    if (isRecording) return;

    try {
      setIsRecording(true);
      setRecordingTime(0);
      recordedChunksRef.current = []; // Reset chunks

      // Request microphone access
      const stream = await getMicrophoneStream();
      mediaStreamRef.current = stream;

      // Create MediaRecorder immediately
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        console.error('Recording error:', event.error);
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      // Auto-stop after 30 seconds
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && isRecording) {
          handleStopRecording();
        }
      }, 30000);
    } catch (error) {
      setIsRecording(false);
      console.error('Failed to start recording:', error);
      showError(
        'Microphone Access Failed',
        'Unable to access your microphone. Please check your browser permissions and try again.'
      );
    }
  };

  // Handle stopping voice input and sending
  const handleStopRecording = async () => {
    if (!isRecording) return;

    setIsRecording(false);

    // Clear timeout
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    // Clear interval
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    try {
      setIsLoading(true);

      // Stop the recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          if (!mediaRecorderRef.current) {
            resolve();
            return;
          }

          mediaRecorderRef.current.onstop = () => {
            resolve();
          };
          mediaRecorderRef.current.stop();
        });
      }

      // Process the recorded chunks
      const chunks = recordedChunksRef.current;
      if (chunks.length === 0) {
        throw new Error('No audio data captured');
      }

      const blob = new Blob(chunks, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();

      // Convert to base64
      const base64 = btoa(
        String.fromCharCode(...Array.from(new Uint8Array(arrayBuffer)))
      );

      // Stop the stream
      if (mediaStreamRef.current) {
        stopAudioStream(mediaStreamRef.current);
        mediaStreamRef.current = null;
      }
      // Stop any ongoing speech
      stopSpeech();
      // Send to speech-to-text API
      const sttResponse = await fetch('/api/ai-assistant/speech-to-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64 }),
      });

      if (!sttResponse.ok) {
        throw new Error('Failed to transcribe audio');
      }

      const { text } = await sttResponse.json();

      if (text && text.trim()) {
        setInput(text);
      }
    } catch (error) {
      console.error('Error processing voice input:', error);
      alert('Failed to process voice. Please try again.');
    } finally {
      setIsLoading(false);
      setRecordingTime(0);
      mediaRecorderRef.current = null;
    }
  };

  // Handle text-to-speech for response using Web Speech Synthesis API
  const handlePlayResponse = async (messageId: string, content: string) => {
    if (isPlaying) return;

    try {
      setIsPlaying(messageId);

      // Strip markdown formatting for speech
      const plainText = content
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/__(.*?)__/g, '$1') // Remove bold (alternative)
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/_(.*?)_/g, '$1') // Remove italic (alternative)
        .replace(/`(.*?)`/g, '$1') // Remove code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
        .replace(/^#{1,6}\s+/gm, '') // Remove headers
        .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
        .replace(/^\s*\d+\.\s+/gm, ''); // Remove ordered list markers

      // Use Web Speech Synthesis API (no API credits needed)
      await speakText(plainText, {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
      });
    } catch (error) {
      console.error('Error playing response:', error);
      showError(
        'Audio Playback Failed',
        'Unable to play audio response. Your browser may not support text-to-speech.'
      );
    } finally {
      setIsPlaying(null);
    }
  };

  // Notify parent of message updates
  useEffect(() => {
    if (onMessagesUpdate && messages.length > 1) {
      onMessagesUpdate(messages);
    }
  }, [messages, onMessagesUpdate]);

  // Handle Enter key (Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle sending a question
  const handleSend = async () => {
    const question = input.trim();
    if (!question || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Save user message to database
      const saveUserResponse = await fetch('/api/ai-assistant/save-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          role: 'user',
          content: question,
        }),
      });

      const saveUserData = await saveUserResponse.json();
      const currentSessionId = saveUserData.sessionId || sessionId;
      setSessionId(currentSessionId);

      // Send question to AI assistant
      const response = await fetch('/api/ai-assistant/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question,
          sessionId: currentSessionId,
          context: messages // Send conversation history for context
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Handle generated title for first message
      if (data.generatedTitle && onGeneratedTitle) {
        onGeneratedTitle(data.generatedTitle);
      }

      // Update session ID
      const finalSessionId = data.sessionId || currentSessionId;
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      // Add assistant response to UI
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        queryInfo: data.queryPlan ? {
          explanation: data.queryPlan.explanation,
          tables: data.queryPlan.tables,
          resultCount: data.resultCount,
        } : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message to database
      try {
        await fetch('/api/ai-assistant/save-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: finalSessionId,
            role: 'assistant',
            content: data.response,
            queryPlan: data.queryPlan ? {
              explanation: data.queryPlan.explanation,
              tables: data.queryPlan.tables,
              resultCount: data.resultCount,
            } : undefined,
          }),
        });
      } catch (saveError) {
        console.error('Error saving assistant message:', saveError);
      }
    } catch (error) {
      console.error('Error asking question:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof Error 
          ? `I'm sorry, I encountered an error: ${error.message}` 
          : "I'm sorry, I encountered an error processing your question.",
        timestamp: new Date(),
        error: true,
      };

      setMessages((prev) => [...prev, errorMessage]);

      // Save error message to database
      if (sessionId) {
        await fetch('/api/ai-assistant/save-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionId,
            role: 'assistant',
            content: errorMessage.content,
            error: true,
          }),
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to safely format timestamp
  const formatTimestamp = (timestamp: Date | string): string => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle suggested question click
  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  // Copy message to clipboard
  const handleCopy = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Error Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
        {errors.map((error) => (
          <div
            key={error.id}
            className="bg-red-900/95 border border-red-700 border-l-4 border-l-red-500 rounded-lg px-4 py-3 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-right-4 duration-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-red-100 text-sm">{error.title}</h3>
                  <p className="text-red-200/80 text-xs mt-1 leading-relaxed">{error.message}</p>
                </div>
              </div>
              <button
                onClick={() => removeError(error.id)}
                className="flex-shrink-0 text-red-300 hover:text-red-100 transition-colors p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {isLoadingHistory ? (
          <div className="flex justify-center items-center h-full">
            <div className="flex gap-2">
              <div className="h-3 w-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
              <div className="h-3 w-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
              <div className="h-3 w-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
            </div>
          </div>
        ) : messages.filter(m => m.role === 'user').length === 0 ? (
          <div />
        ) : (
          messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`flex gap-3 max-w-2xl ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center shadow-lg ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                    : message.error
                    ? 'bg-gradient-to-br from-red-500 to-red-600'
                    : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                }`}
              >
                {message.role === 'user' ? (
                  <User className="h-5 w-5 text-white" />
                ) : message.error ? (
                  <AlertCircle className="h-5 w-5 text-white" />
                ) : (
                  <Bot className="h-5 w-5 text-white" />
                )}
              </div>

              {/* Message Content */}
              <div
                className={`group rounded-2xl px-5 py-3.5 shadow-lg transition-all ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-none'
                    : message.error
                    ? 'bg-red-900/30 text-red-100 border border-red-700/50 rounded-bl-none backdrop-blur'
                    : 'bg-slate-700 text-slate-50 border border-slate-600/30 rounded-bl-none backdrop-blur'
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
                        <ReactMarkdown
                          components={{
                            p: ({node, ...props}) => <p {...props} className="m-0 mb-2 last:mb-0" />,
                            ul: ({node, ...props}) => <ul {...props} className="list-disc list-inside my-2 space-y-1" />,
                            ol: ({node, ...props}) => <ol {...props} className="list-decimal list-inside my-2 space-y-1" />,
                            li: ({node, ...props}) => <li {...props} className="ml-0" />,
                            strong: ({node, ...props}) => <strong {...props} className="font-bold" />,
                            code: ({node, ...props}) => 
                              <code {...props} className="bg-slate-800 px-1.5 py-0.5 rounded text-xs" />,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    )}
                  </div>
                  <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {message.role === 'assistant' && !message.error && isSpeechEnabled && (
                      <button
                        onClick={() => handlePlayResponse(message.id, message.content)}
                        disabled={isPlaying !== null}
                        className="flex-shrink-0 p-1.5 hover:bg-slate-600/50 rounded disabled:opacity-50"
                        title="Play audio response"
                      >
                        {isPlaying === message.id ? (
                          <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                        ) : (
                          <Volume2 className="h-4 w-4 text-emerald-400 hover:text-emerald-300" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(message.content, message.id)}
                      className="opacity-100 flex-shrink-0 p-1.5 hover:bg-slate-600/50 rounded"
                    >
                      {copiedId === message.id ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-slate-300 hover:text-white" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Timestamp & Query Info */}
                <div className="mt-3 pt-2 border-t border-slate-600/30">
                  <p
                    className={`text-xs opacity-70 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {formatTimestamp(message.timestamp)}
                  </p>
                  
                  {message.queryInfo && (
                    <button
                      onClick={() => setExpandedQueryInfoId(expandedQueryInfoId === message.id ? null : message.id)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 flex items-center gap-1"
                    >
                      <Info className="h-3 w-3" />
                      Query Info
                    </button>
                  )}
                </div>

                {/* Query Info Details */}
                {message.queryInfo && expandedQueryInfoId === message.id && (
                  <div className="mt-3 pt-3 border-t border-slate-600/30 text-xs text-slate-300 bg-slate-800/50 -mx-5 -my-3.5 px-5 py-3.5 rounded-lg">
                    <p className="font-semibold text-emerald-400 mb-2">Query Information:</p>
                    <p className="mb-2"><strong>Explanation:</strong> {message.queryInfo.explanation}</p>
                    {message.queryInfo.tables && (
                      <p><strong>Tables:</strong> {Array.isArray(message.queryInfo.tables) ? message.queryInfo.tables.join(', ') : message.queryInfo.tables}</p>
                    )}
                    {message.queryInfo.resultCount && (
                      <p className="mt-1"><strong>Results:</strong> {message.queryInfo.resultCount} records</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-3">
              <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="bg-slate-700 border border-slate-600/30 rounded-2xl px-5 py-3.5 rounded-bl-none shadow-lg backdrop-blur">
                <div className="flex gap-1">
                  <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                  <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                  <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Help Prompt */}
      {!isLoadingHistory && messages.filter(m => m.role === 'user').length === 0 && (
        <div className="flex-1 flex items-center justify-center pb-20">
          <p className="text-2xl font-semibold text-slate-400">What can I help with</p>
        </div>
      )}

      {/* Premium Input Area */}
      <div className="px-6 pb-6 border-t border-slate-700">
        {/* Recording Status Bar */}
        {isRecording && (
          <div className="mb-3 px-4 py-2 bg-red-900/30 border border-red-700/50 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm text-red-100">Recording...</span>
              <span className="text-xs text-red-200 ml-2 font-mono">{formatDuration(recordingTime)}</span>
            </div>
            <button
              onClick={handleStopRecording}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
            >
              Stop
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {/* Mic Button */}
          {isSpeechEnabled && (
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={isLoading}
              className={`flex-shrink-0 px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-slate-800 transition-all font-medium ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200 focus:ring-red-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              {isRecording ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>
          )}

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className="flex-1 px-4 py-3 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-slate-800 focus:border-transparent focus:bg-slate-700 resize-none disabled:bg-slate-800 disabled:cursor-not-allowed transition-all font-medium placeholder-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl font-medium"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
