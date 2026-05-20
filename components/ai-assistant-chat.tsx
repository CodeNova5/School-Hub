/**
 * AI Assistant Chat Component - Enhanced Edition
 * Improved UI/UX with modern design, smooth animations, and better user interactions
 * Features: Auto-expanding textarea, smooth transitions, better message layout, suggestion chips
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, AlertCircle, Info, Copy, Check, Mic, MicOff, Volume2, VolumeX, X, ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { recordAudio, playAudio, getMicrophoneStream, stopAudioStream, formatDuration, checkMicrophonePermission, speakText, stopSpeech } from '@/lib/audio-utils';
import { useSchoolContext } from '@/hooks/use-school-context';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
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
  
  const { schoolId } = useSchoolContext();
  
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

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  }, [input]);

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
            const welcomeMsg: Message = {
              id: '0',
              role: 'assistant',
              content: welcomeMessage,
              timestamp: new Date(),
            };
            setMessages([welcomeMsg]);
          }
        } else {
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
            const welcomeMsg: Message = {
              id: '0',
              role: 'assistant',
              content: welcomeMessage,
              timestamp: new Date(),
            };
            setMessages([welcomeMsg]);
          }
        }
        retryCount = 0;
      } catch (error: any) {
        console.error('Error loading chat history:', error);
        
        if (!isMounted) return;
        
        if (error?.status === 429 || retryCount >= maxRetries) {
          console.warn('Max retries reached or rate limited');
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
          retryCount++;
        }
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    };

    loadChatHistory();

    return () => {
      isMounted = false;
    };
  }, [propSessionId]);

  // Scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          sessionId,
          schoolId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          queryInfo: data.queryInfo,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setSessionId(data.sessionId);

        if (onSessionIdChange && data.sessionId) {
          onSessionIdChange(data.sessionId);
        }

        if (autoPlayResponses && isSpeechEnabled) {
          await handlePlayResponse(assistantMessage.id, assistantMessage.content);
        }
      } else {
        showError('Error', data.message || 'Failed to process message');
      }
    } catch (error: any) {
      showError('Error', 'Failed to send message. Please try again.');
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle keyboard input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle copy to clipboard
  const handleCopy = (content: string, messageId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle start recording
  const handleStartRecording = async () => {
    try {
      const permissionGranted = await checkMicrophonePermission();
      if (!permissionGranted) {
        showError('Permission Denied', 'Microphone permission is required to record');
        return;
      }

      const stream = await getMicrophoneStream();
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      recordingTimeoutRef.current = setTimeout(() => {
        handleStopRecording();
      }, 60000);
    } catch (error: any) {
      showError('Recording Error', 'Failed to start recording');
      console.error('Error starting recording:', error);
    }
  };

  // Handle stop recording
  const handleStopRecording = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();

      mediaRecorderRef.current.onstop = async () => {
        if (recordedChunksRef.current.length > 0) {
          const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
          // Process audio blob - transcribe and send
          try {
            const formData = new FormData();
            formData.append('audio', audioBlob);
            
            const response = await fetch('/api/ai-assistant/transcribe', {
              method: 'POST',
              body: formData,
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.text) {
                setInput(data.text);
              }
            } else {
              showError('Transcription Error', 'Failed to transcribe audio');
            }
          } catch (error: any) {
            showError('Transcription Error', 'Failed to transcribe audio');
            console.error('Error transcribing audio:', error);
          }
        }

        if (mediaStreamRef.current) {
          stopAudioStream(mediaStreamRef.current);
        }
      };
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }

    setIsRecording(false);
    setRecordingTime(0);
  };

  // Handle play response
  const handlePlayResponse = async (messageId: string, content: string) => {
    try {
      setIsPlaying(messageId);
      await speakText(content);
      setIsPlaying(null);
    } catch (error: any) {
      showError('Playback Error', 'Failed to play audio response');
      setIsPlaying(null);
    }
  };

  // Format timestamp
  const formatTimestamp = (dateValue: Date | string) => {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // Handle suggested question click
  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
      {/* Error Notifications */}
      <div className="fixed top-0 right-0 pt-4 pr-4 space-y-2 pointer-events-none z-50">
        {errors.map((error) => (
          <div
            key={error.id}
            className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-100 text-sm backdrop-blur-sm pointer-events-auto animate-in slide-in-from-top-2"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                {error.title && <p className="font-medium">{error.title}</p>}
                <p className="text-xs opacity-90">{error.message}</p>
              </div>
              <button
                onClick={() => removeError(error.id)}
                className="flex-shrink-0 text-red-100 hover:text-red-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Loading History State */}
      {isLoadingHistory ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <p className="text-slate-400 text-sm">Loading conversation...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Avatar */}
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-md">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                )}

                {/* Message Container */}
                <div className={`flex flex-col gap-2 max-w-2xl ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Message Bubble */}
                  <div
                    className={`group rounded-2xl px-4 py-3 transition-all ${
                      message.role === 'assistant'
                        ? 'bg-slate-700/50 border border-slate-600/30 text-slate-100'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                    } ${message.error ? 'border-red-500/50 bg-red-500/10' : ''}`}
                  >
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

                  {/* Message Actions */}
                  <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {message.role === 'assistant' && !message.error && isSpeechEnabled && (
                      <button
                        onClick={() => handlePlayResponse(message.id, message.content)}
                        disabled={isPlaying !== null}
                        className="p-1.5 hover:bg-slate-600/50 rounded transition-colors disabled:opacity-50"
                        title="Play audio response"
                      >
                        {isPlaying === message.id ? (
                          <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                        ) : (
                          <Volume2 className="h-4 w-4 text-emerald-400" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleCopy(message.content, message.id)}
                      className="p-1.5 hover:bg-slate-600/50 rounded transition-colors"
                      title="Copy message"
                    >
                      {copiedId === message.id ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                  </div>

                  {/* Timestamp & Query Info */}
                  {message.role === 'assistant' && (
                    <div className="mt-1 pt-2 border-t border-slate-600/20">
                      <p className="text-xs text-slate-500">
                        {formatTimestamp(message.timestamp)}
                      </p>
                      
                      {message.queryInfo && (
                        <button
                          onClick={() => setExpandedQueryInfoId(expandedQueryInfoId === message.id ? null : message.id)}
                          className="text-xs text-emerald-400/80 hover:text-emerald-300 mt-1 flex items-center gap-1 transition-colors"
                        >
                          <Info className="h-3 w-3" />
                          Query info
                          <ChevronDown 
                            className={`h-3 w-3 transition-transform ${expandedQueryInfoId === message.id ? 'rotate-180' : ''}`}
                          />
                        </button>
                      )}

                      {/* Query Info Details */}
                      {message.queryInfo && expandedQueryInfoId === message.id && (
                        <div className="mt-2 pt-2 border-t border-slate-600/20 text-xs text-slate-300 space-y-1">
                          <p><span className="text-slate-400">Query:</span> {message.queryInfo.explanation}</p>
                          {message.queryInfo.tables && (
                            <p><span className="text-slate-400">Tables:</span> {Array.isArray(message.queryInfo.tables) ? message.queryInfo.tables.join(', ') : message.queryInfo.tables}</p>
                          )}
                          {typeof message.queryInfo.resultCount === 'number' && (
                            <p><span className="text-slate-400">Results:</span> {message.queryInfo.resultCount} {message.queryInfo.resultCount === 1 ? 'record' : 'records'}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {message.role === 'user' && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-md">
                    <User className="h-5 w-5 text-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start animate-in fade-in">
                <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-md">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div className="bg-slate-700/50 border border-slate-600/30 rounded-2xl px-4 py-3">
                  <div className="flex gap-2">
                    <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                    <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                    <div className="h-2 w-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          {!isLoadingHistory && messages.filter(m => m.role === 'user').length === 0 && suggestedQuestions.length > 0 && (
            <div className="px-4 pb-4">
              <p className="text-xs text-slate-400 mb-3 font-medium">Suggested questions:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestedQuestions.map((question, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="text-left px-3 py-2 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600/30 rounded-lg text-sm text-slate-300 hover:text-slate-100 transition-all"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="border-t border-slate-700/50 bg-slate-900/50 backdrop-blur-sm px-4 py-4 space-y-3">
            {/* Recording Status */}
            {isRecording && (
              <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-red-100">Recording in progress</span>
                  <span className="text-xs text-red-200 ml-2 font-mono">{formatDuration(recordingTime)}</span>
                </div>
                <button
                  onClick={handleStopRecording}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                >
                  Stop
                </button>
              </div>
            )}

            {/* Input Controls */}
            <div className="flex gap-2">
              {/* Mic Button */}
              {isSpeechEnabled && (
                <button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  disabled={isLoading}
                  className={`flex-shrink-0 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-slate-900 transition-all ${
                    isRecording
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
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

              {/* Text Input */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                rows={1}
                className="flex-1 px-4 py-2.5 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-slate-700 resize-none disabled:bg-slate-800 disabled:cursor-not-allowed transition-all placeholder-slate-500"
              />

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 px-3 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                title="Send message (Shift+Enter for new line)"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Keyboard Hint */}
            <p className="text-xs text-slate-500 text-center">Use Shift+Enter for a new line</p>
          </div>
        </>
      )}
    </div>
  );
}
