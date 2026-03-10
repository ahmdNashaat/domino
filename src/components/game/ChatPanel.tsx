import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { useSocket } from '@/hooks/useSocket';
import { useSettingsStore } from '@/store/settingsStore';
import { playChatNotificationSound } from '@/utils/soundEffects';

const QUICK_REPLIES = [
  { text: 'يلا 🔥', label: 'يلا 🔥' },
  { text: 'برافو 👏', label: 'برافو 👏' },
  { text: 'إبلـع 🍀', label: 'إبلـع 🍀' },
  { text: 'خد يزلفي 🎮', label: 'خد يزلفي 🎮' },
];

const MAX_LENGTH = 200;

export default function ChatPanel() {
  const { messages, isOpen, setOpen, unreadCount } = useChatStore();
  const chatEnabled = useSettingsStore((s) => s.chatEnabled);
  const { sendChat } = useSocket();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMsgCount = useRef(messages.length);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Play notification sound on new opponent message
  useEffect(() => {
    if (messages.length > prevMsgCount.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.sender === 'opponent') {
        playChatNotificationSound();
      }
    }
    prevMsgCount.current = messages.length;
  }, [messages]);

  if (!chatEnabled) return null;

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendChat(trimmed);
    setText('');
  };

  const handleQuickReply = (msg: string) => {
    sendChat(msg);
  };

  return (
    <>
      {/* Toggle button */}
      {!isOpen && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-24 z-50 p-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform"
        >
          <MessageCircle className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 right-0 z-50 w-72 h-[60vh] max-h-[420px] flex flex-col bg-card border border-border rounded-tl-2xl rounded-tr-none shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-secondary/80 border-b border-border/50">
              <span className="text-sm font-arabic font-bold text-foreground">💬 الشات</span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-8 font-arabic">
                  ابدأ المحادثة مع خصمك! 💬
                </p>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-1.5 rounded-2xl text-sm font-arabic ${
                      msg.sender === 'me'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    <p className="break-words">{msg.text}</p>
                    <span className={`text-[9px] block mt-0.5 ${
                      msg.sender === 'me' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                    }`}>
                      {new Date(msg.timestamp).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick replies */}
            <div className="flex gap-1 px-2 py-1.5 overflow-x-auto border-t border-border/30">
              {QUICK_REPLIES.map((qr) => (
                <button
                  key={qr.text}
                  onClick={() => handleQuickReply(qr.text)}
                  className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-arabic bg-accent/20 text-accent-foreground hover:bg-accent/40 transition-colors border border-accent/20"
                >
                  {qr.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-2 py-2 border-t border-border/50 bg-secondary/40">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="اكتب رسالة..."
                className="flex-1 bg-background border border-input rounded-full px-3 py-1.5 text-sm font-arabic placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                dir="rtl"
                maxLength={MAX_LENGTH}
              />
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                className="p-2 rounded-full bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
              >
                <Send className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
