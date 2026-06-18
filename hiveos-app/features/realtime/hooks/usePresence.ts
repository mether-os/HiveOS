import { create } from "zustand";

export interface UserPresence {
  id: string;
  name: string;
  email: string;
  image?: string;
}

interface PresenceState {
  onlineUsers: Record<string, UserPresence>;
  workspaceMembers: UserPresence[];
  typingUsers: Record<string, { name: string; isTyping: boolean }>;
  
  // Actions
  setOnline: (userId: string, user: UserPresence) => void;
  setOffline: (userId: string) => void;
  setWorkspaceMembers: (members: UserPresence[]) => void;
  setTyping: (userId: string, name: string, isTyping: boolean) => void;
  clearWorkspacePresence: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: {},
  workspaceMembers: [],
  typingUsers: {},

  setOnline: (userId, user) =>
    set((state) => ({
      onlineUsers: { ...state.onlineUsers, [userId]: user },
    })),

  setOffline: (userId) =>
    set((state) => {
      const newOnline = { ...state.onlineUsers };
      delete newOnline[userId];
      return { onlineUsers: newOnline };
    }),

  setWorkspaceMembers: (members) =>
    set(() => ({
      workspaceMembers: members,
    })),

  setTyping: (userId, name, isTyping) =>
    set((state) => {
      const newTyping = { ...state.typingUsers };
      if (isTyping) {
        newTyping[userId] = { name, isTyping };
      } else {
        delete newTyping[userId];
      }
      return { typingUsers: newTyping };
    }),

  clearWorkspacePresence: () =>
    set(() => ({
      workspaceMembers: [],
      typingUsers: {},
    })),
}));
