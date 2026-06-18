/**
 * features/hives/types.ts — Hive Domain Types (Client-safe)
 *
 * Purpose: TypeScript types for the Hive domain used in client components.
 * These are PLAIN types — no Mongoose, no server imports.
 *
 * Why duplicate from server/models/Hive.ts?
 * The server model imports Mongoose (Node.js only). Client components
 * cannot use it. These types mirror the SerializedHive shape that the
 * API returns — strings only, no ObjectIds or Date objects.
 *
 * Single source of API contract:
 * Server: server/models/Hive.ts defines SerializedHive
 * Client: features/hives/types.ts re-declares the same shape
 * Both must stay in sync. When the API changes, update both.
 *
 * Interactions:
 * - Used by: features/hives/hooks/useHives.ts
 * - Used by: features/hives/components/*.tsx
 * - NOT used by: server files (they use SerializedHive from the model)
 */

// ---------------------------------------------------------------------------
// Hive entity — matches the serialized API response
// ---------------------------------------------------------------------------
export interface Hive {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: string; // ISO date string
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// API request payloads
// ---------------------------------------------------------------------------
export interface CreateHivePayload {
  name: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// API response wrapper — matches { data, error } structure from all routes
// ---------------------------------------------------------------------------
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  details?: Record<string, string[]>;
}
