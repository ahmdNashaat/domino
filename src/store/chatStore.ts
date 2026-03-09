import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  sender: 'me' | 'opponent';
  senderName: string;
  text: string;
  timestamp: number;
}

interface ChatStore {
  messages: ChatMessage[];
  unreadCount: number;
  isOpen: boolean;
  addMessage: (msg: ChatMessage) => void;
  clearMessages: () => void;
  resetUnread: () => void;
  setOpen: (open: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  unreadCount: 0,
  isOpen: false,
  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, msg],
      unreadCount: s.isOpen ? s.unreadCount : s.unreadCount + (msg.sender === 'opponent' ? 1 : 0),
    })),
  clearMessages: () => set({ messages: [], unreadCount: 0 }),
  resetUnread: () => set({ unreadCount: 0 }),
  setOpen: (open) => set({ isOpen: open, ...(open ? { unreadCount: 0 } : {}) }),
}));
