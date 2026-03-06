/**
 * AI Assistant Chat Component
 * Provides a chat-like interface for asking questions about school data
 * Supports session-based chat history and memory preservation
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, AlertCircle, Info, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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

interface AIAssistantChatProps {
  welcomeMessage?: string;
  placeholder?: string;
  suggestedQuestions?: string[];
  initialMessages?: Message[];
  onMessagesUpdate?: (messages: Message[]) => void;
  sessionId?: string;
  onSessionIdChange?: (sessionId: string) => void;
}

export default function AIAssistantChat({
  welcomeMessage = "Hi! I'm your AI assistant. Ask me anything about students, classes, grades, teachers, and more!",
  placeholder = "Ask a question about school data...",
  suggestedQuestions = [],
  initialMessages = [],
  onMessagesUpdate,
  sessionId: propSessionId,
  onSessionIdChange,
}: AIAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(propSessionId || null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [showQueryInfo, setShowQueryInfo] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

    return () => {
      isMounted = false;
    };
  }, [propSessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

      // Add assistant response
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
      // Update sessionId from response
      if (data.sessionId) {
        setSessionId(data.sessionId);
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
                  {message.role === 'assistant' && !message.error && (
                    <button
                      onClick={() => handleCopy(message.content, message.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1.5 hover:bg-slate-600/50 rounded"
                    >
                      {copiedId === message.id ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4 text-slate-300 hover:text-white" />
                      )}
                    </button>
                  )}
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
                      onClick={() => setShowQueryInfo(!showQueryInfo)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 flex items-center gap-1"
                    >
                      <Info className="h-3 w-3" />
                      Query Info
                    </button>
                  )}
                </div>

                {/* Query Info Details */}
                {message.queryInfo && showQueryInfo && (
                  <div className="mt-3 pt-3 border-t border-slate-600/30 text-xs text-slate-300 bg-slate-800/50 -mx-5 -my-3.5 px-5 py-3.5 rounded-lg">
                    <p className="font-semibold text-emerald-400 mb-2">Query Information:</p>
                    <p className="mb-2"><strong>Explanation:</strong> {message.queryInfo.explanation}</p>
                    <p><strong>Tables:</strong> {message.queryInfo.tables.join(', ')}</p>
                    {message.queryInfo.resultCount && (
                      <p className="mt-1"><strong>Results:</strong> {message.queryInfo.resultCount} records</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )))}

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

      {/* Suggested Questions */}
      {!isLoadingHistory && suggestedQuestions.length > 0 && messages.filter(m => m.role === 'user').length === 0 && (
        <div className="px-6 pb-6">
          <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">💡 Try asking:</p>
          <div className="grid grid-cols-1 gap-2">
            {suggestedQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedQuestion(question)}
                className="text-sm px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-slate-100 font-medium rounded-lg transition-all duration-200 border border-slate-600 hover:border-slate-500 hover:shadow-lg text-left"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Premium Input Area */}
      <div className="px-6 pb-6 border-t border-slate-700">
        <div className="flex gap-3">
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
