"use client";

import React, { useEffect, useCallback } from "react";
import { useSocket } from "../hooks/useSocket";
import { usePresenceStore } from "../hooks/usePresence";

interface RealtimeWorkspaceControllerProps {
  hiveId: string;
}

export const RealtimeWorkspaceController: React.FC<RealtimeWorkspaceControllerProps> = ({
  hiveId,
}) => {
  const { socket, status } = useSocket();
  const clearWorkspacePresence = usePresenceStore((state) => state.clearWorkspacePresence);

  // RT-3 fix: re-fetch canvas state from API on every (re)connect
  // so stale nodes/edges after a network drop are refreshed immediately
  const resyncCanvasState = useCallback(async () => {
    try {
      const res = await fetch(`/api/hives/${hiveId}/canvas`);
      if (!res.ok) return;
      const data = await res.json();
      // Dispatch a custom event that CanvasBoard listens to
      // This avoids prop drilling through the layout tree
      window.dispatchEvent(
        new CustomEvent("canvas:resync", { detail: { nodes: data.nodes, edges: data.edges } })
      );
    } catch (err) {
      console.error("[Realtime Controller] Canvas resync failed:", err);
    }
  }, [hiveId]);

  useEffect(() => {
    if (!socket || status !== "connected") return;

    console.log(`[Realtime Controller] Socket active, joining workspace room: ${hiveId}`);
    socket.emit("workspace:join", { workspaceId: hiveId });

    // RT-3: resync canvas state on every connect (covers both initial connect
    // and reconnects after a network drop — status flips to "connected" both times)
    resyncCanvasState();

    return () => {
      console.log(`[Realtime Controller] Leaving workspace room: ${hiveId}`);
      socket.emit("workspace:leave");
      clearWorkspacePresence();
    };
  }, [socket, status, hiveId, clearWorkspacePresence, resyncCanvasState]);

  return null;
};