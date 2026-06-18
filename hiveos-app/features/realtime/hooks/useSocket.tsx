"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "@/lib/auth-client";
import { usePresenceStore, UserPresence } from "./usePresence";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface RealtimeContextType {
  socket: Socket | null;
  status: ConnectionStatus;
}

const RealtimeContext = createContext<RealtimeContextType>({
  socket: null,
  status: "disconnected",
});

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3002";

interface RealtimeProviderProps {
  children: React.ReactNode;
  onReconnect?: () => void;
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({ children, onReconnect }) => {
  const { data: session, isPending } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  // Use refs for Zustand store actions to avoid dependency array churn
  const storeRef = useRef(usePresenceStore.getState());
  useEffect(() => {
    const unsub = usePresenceStore.subscribe((state) => {
      storeRef.current = state;
    });
    return unsub;
  }, []);

  // Stable ref for onReconnect callback
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  // Extract stable user ID to avoid re-running effect when session object reference changes
  const userId = session?.user?.id;

  useEffect(() => {
    if (isPending || !userId) {
      return;
    }

    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    setStatus("connecting");

    newSocket.on("connect", () => {
      setStatus("connected");
      onReconnectRef.current?.();
    });

    newSocket.on("disconnect", () => {
      setStatus("disconnected");
    });

    newSocket.on("connect_error", () => {
      setStatus("error");
    });

    newSocket.on("user:status", (data: { userId: string; status: "online" | "offline"; user?: UserPresence }) => {
      if (data.status === "online" && data.user) {
        storeRef.current.setOnline(data.userId, data.user);
      } else {
        storeRef.current.setOffline(data.userId);
      }
    });

    newSocket.on("workspace:presence", (data: { workspaceId: string; members: UserPresence[] }) => {
      storeRef.current.setWorkspaceMembers(data.members);
    });

    newSocket.on("typing:update", (data: { workspaceId: string; userId: string; name: string; isTyping: boolean }) => {
      storeRef.current.setTyping(data.userId, data.name, data.isTyping);
    });

    setSocket(newSocket);

    return () => {
      newSocket.removeAllListeners();
      newSocket.disconnect();
      setSocket(null);
      setStatus("disconnected");
    };
  }, [userId, isPending]);

  return (
    <RealtimeContext.Provider value={{ socket, status }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useSocket must be used within a RealtimeProvider");
  }
  return context;
};
