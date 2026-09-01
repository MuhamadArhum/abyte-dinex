import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Sparkles, Minimize2, Maximize2, Trash2, Copy, Check } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

const AIWidget = () => {
  const { hasPermission } = useAuth();

  // Only render for users who have the system.ai_widget permission
  // (Admin always has access since hasPermission returns true when permissions === null)
  if (!hasPermission('system.ai_widget')) return null;

  return <AIWidgetInner />;
};

const AIWidgetInner = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: 'Hello! 👋 I am your AByte AI Assistant.\n\nI have access to your live business data and can help you with:\n\n• Sales & revenue analysis\n• Inventory & stock levels\n• Customer insights\n• Staff & payroll info\n• Expense tracking\n• Business performance\n\nAsk me in English or Urdu!',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) inputRef.current?.focus();
  }, [isOpen, isMinimized]);

  // Auto-hide tooltip after 5 seconds
  useEffect(() => {
    const t = setTimeout(() => setShowTooltip(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/ai/chat', {
        message: userMsg.text,
        history: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        })).slice(-10)
      });

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.data.reply,
        timestamp: new Date()
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Sorry, I'm having trouble connecting. Please try again. 😔",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Clear all messages?')) {
      setMessages([{
        id: '1',
        role: 'model',
        text: 'Chat cleared. How can I help you?',
        timestamp: new Date()
      }]);
    }
  };

  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const formatMessageText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        return (
          <div key={idx} className="flex gap-2 ml-2">
            <span className="text-emerald-400 font-bold">•</span>
            <span>{line.replace(/^[•-]\s*/, '')}</span>
          </div>
        );
      }
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <div key={idx}>
            {parts.map((part, i) =>
              i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
            )}
          </div>
        );
      }
      return line ? <div key={idx}>{line}</div> : <div key={idx} className="h-2" />;
    });
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div className={`mb-4 bg-white rounded-2xl shadow-2xl border-2 border-emerald-200 flex flex-col overflow-hidden transition-all duration-300 ${
          isMinimized ? 'w-72 sm:w-80 h-16' : 'w-[calc(100vw-32px)] sm:w-[450px] h-[80vh] sm:h-[650px] max-h-[80vh] sm:max-h-[85vh]'
        } animate-in fade-in slide-in-from-bottom-10 duration-300`}>

          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-blue-700 to-emerald-600 p-4 text-white flex justify-between items-center shadow-lg flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <Bot size={24} className="text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-emerald-700 animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  AByte AI Assistant
                  <Sparkles size={16} className="text-yellow-300 animate-pulse" />
                </h3>
                <span className="text-xs text-emerald-100 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Live Business Data • Always Ready
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="hover:bg-white/20 p-2 rounded-lg transition-all"
                title={isMinimized ? 'Maximize' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
              </button>
              {!isMinimized && (
                <button
                  onClick={handleClearChat}
                  className="hover:bg-white/20 p-2 rounded-lg transition-all"
                  title="Clear Chat"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 p-2 rounded-lg transition-all"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Messages */}
          {!isMinimized && (
            <>
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-gradient-to-b from-gray-50 to-white space-y-4 scrollbar-thin">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group`}>
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
                        : 'bg-gradient-to-br from-blue-500 to-emerald-500 text-white'
                    }`}>
                      {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                    </div>

                    {/* Bubble */}
                    <div className="flex flex-col max-w-[78%]">
                      <div className={`p-3.5 rounded-2xl text-sm shadow-sm transition-all duration-200 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-tr-none'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                      }`}>
                        <div className="space-y-1 leading-relaxed">
                          {msg.role === 'model' ? formatMessageText(msg.text) : msg.text}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className={`flex items-center gap-2 mt-1 px-1 text-xs text-gray-400 ${
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}>
                        <span>{formatTime(msg.timestamp)}</span>
                        {msg.role === 'model' && (
                          <button
                            onClick={() => handleCopyMessage(msg.text, msg.id)}
                            className="opacity-0 group-hover:opacity-100 hover:text-emerald-600 transition-all p-1 hover:bg-emerald-50 rounded"
                            title="Copy"
                          >
                            {copiedId === msg.id
                              ? <Check size={12} className="text-green-500" />
                              : <Copy size={12} />
                            }
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Bot size={18} />
                    </div>
                    <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-gray-100">
                      <div className="flex gap-1.5 items-center">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" />
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 sm:p-4 bg-white border-t border-gray-100 flex-shrink-0">
                <div className="flex gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Ask about sales, stock, staff..."
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 focus:bg-white transition-all placeholder-gray-400"
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-3 rounded-xl hover:from-emerald-700 hover:to-emerald-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:scale-105 disabled:scale-100"
                  >
                    <Send size={20} />
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-400 text-center">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Enter</kbd> to send
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB Toggle */}
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) setIsMinimized(false); }}
        className={`relative p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${
          isOpen
            ? 'bg-gradient-to-r from-red-500 to-red-600 text-white rotate-90'
            : 'bg-gradient-to-r from-emerald-600 to-emerald-600 text-white'
        }`}
        title={isOpen ? 'Close Chat' : 'Open AI Assistant'}
      >
        {isOpen ? <X size={28} /> : (
          <>
            <MessageCircle size={28} />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
          </>
        )}
      </button>

      {/* Hint tooltip — auto-hides after 5s */}
      {!isOpen && showTooltip && (
        <div className="absolute bottom-20 right-0 bg-white text-gray-800 px-3 sm:px-4 py-2 rounded-lg shadow-xl border-2 border-emerald-200 text-xs sm:text-sm font-medium whitespace-nowrap">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-600" />
            Ask about your business!
          </div>
          <div className="absolute top-1/2 -right-2 w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-8 border-l-emerald-200 -translate-y-1/2" />
        </div>
      )}
    </div>
  );
};

export default AIWidget;
