/**
 * server/actions/hives.ts — Hive Data Access Layer
 *
 * Purpose: All database operations for Hive documents. This is the ONLY
 *          place in the codebase that directly queries the Hive collection.
 *
 * Why a separate actions layer instead of querying from route handlers?
 * Clean architecture — route handlers should only: validate input, call
 * actions, and format responses. Business logic and DB queries live here.
 * This makes it trivial to:
 * - Unit test actions independently of HTTP
 * - Reuse the same logic in multiple routes
 * - Swap the DB layer (e.g., to Postgres) without touching routes
 *
 * All functions:
 * - Accept userId as a string (from Better Auth session)
 * - Return typed results (SerializedHive or null)
 * - Handle their own DB connection via connectDB()
 * - Throw errors up to the route handler for formatting
 *
 * Interactions:
 * - Calls: lib/db.ts (connection), server/models/Hive.ts (schema)
 * - Called by: app/api/hives/route.ts, app/api/hives/[hiveId]/route.ts
 * - Never called by: client components (never import from server/)
 */

import connectDB from "@/lib/db";
import Hive, { type SerializedHive } from "@/server/models/Hive";
import mongoose from "mongoose";
import CanvasNode from "@/server/models/CanvasNode";
import CanvasEdge from "@/server/models/CanvasEdge";
import Document from "@/server/models/Document";
import DocumentVersion from "@/server/models/DocumentVersion";
import Activity from "@/server/models/Activity";
import ChatMessage from "@/server/models/ChatMessage";
import Workflow from "@/server/models/Workflow";
import WorkflowRun from "@/server/models/WorkflowRun";
import AgentActionPlan from "@/server/models/AgentActionPlan";
import AgentAction from "@/server/models/AgentAction";
import KnowledgeIndex from "@/server/models/KnowledgeIndex";
import HiveMindRecommendation from "@/server/models/HiveMindRecommendation";
import HiveMindSnapshot from "@/server/models/HiveMindSnapshot";
import HiveMindMission from "@/server/models/HiveMindMission";
import IntelligenceNotification from "@/server/models/IntelligenceNotification";
import SearchMetric from "@/server/models/SearchMetric";
import ChatMetric from "@/server/models/ChatMetric";
import AgentInstance from "@/server/models/AgentInstance";

// ---------------------------------------------------------------------------
// Input types — validated by Zod in route handlers before passing here
// ---------------------------------------------------------------------------

export interface CreateHiveInput {
  name: string;
  description?: string;
  ownerId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validates and converts a string ID to a MongoDB ObjectId.
 * Returns null if the ID format is invalid.
 */
function toObjectId(id: string): mongoose.Types.ObjectId | null {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

// ---------------------------------------------------------------------------
// Action: getUserHives
// Returns all hives owned by a user, newest first
// ---------------------------------------------------------------------------

export async function getUserHives(userId: string): Promise<SerializedHive[]> {
  await connectDB();

  const ownerId = toObjectId(userId);
  if (!ownerId) {
    throw new Error(`Invalid userId format: ${userId}`);
  }

  // Compound index { ownerId: 1, createdAt: -1 } makes this O(log n)
  const hives = await Hive.find({ ownerId })
    .sort({ createdAt: -1 })
    .lean() // Returns plain objects, faster than full Mongoose documents
    .exec();

  return hives.map((hive) => ({
    id: hive._id.toString(),
    name: hive.name,
    description: hive.description,
    ownerId: hive.ownerId.toString(),
    githubRepo: (hive.githubRepo && hive.githubRepo.owner && hive.githubRepo.repo) ? {
      owner: hive.githubRepo.owner,
      repo: hive.githubRepo.repo,
      webhookId: hive.githubRepo.webhookId,
      webhookSecret: hive.githubRepo.webhookSecret,
      connectedAt: hive.githubRepo.connectedAt
        ? (hive.githubRepo.connectedAt instanceof Date
          ? hive.githubRepo.connectedAt.toISOString()
          : new Date(hive.githubRepo.connectedAt).toISOString())
        : undefined,
      status: hive.githubRepo.status as "connected" | "disconnected",
    } : undefined,
    createdAt: hive.createdAt.toISOString(),
    updatedAt: hive.updatedAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Action: getHiveById
// Returns a single hive if the user is the owner
// ---------------------------------------------------------------------------

export async function getHiveById(
  hiveId: string,
  userId: string
): Promise<SerializedHive | null> {
  await connectDB();

  const id = toObjectId(hiveId);
  const ownerId = toObjectId(userId);

  if (!id || !ownerId) return null;

  const hive = await Hive.findOne({ _id: id, ownerId }).lean().exec();
  if (!hive) return null;

  return {
    id: hive._id.toString(),
    name: hive.name,
    description: hive.description,
    ownerId: hive.ownerId.toString(),
    githubRepo: (hive.githubRepo && hive.githubRepo.owner && hive.githubRepo.repo) ? {
      owner: hive.githubRepo.owner,
      repo: hive.githubRepo.repo,
      webhookId: hive.githubRepo.webhookId,
      webhookSecret: hive.githubRepo.webhookSecret,
      connectedAt: hive.githubRepo.connectedAt
        ? (hive.githubRepo.connectedAt instanceof Date
          ? hive.githubRepo.connectedAt.toISOString()
          : new Date(hive.githubRepo.connectedAt).toISOString())
        : undefined,
      status: hive.githubRepo.status as "connected" | "disconnected",
    } : undefined,
    createdAt: hive.createdAt.toISOString(),
    updatedAt: hive.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Action: createHive
// Creates a new hive document. Returns the serialized result.
// ---------------------------------------------------------------------------

export async function createHive(
  input: CreateHiveInput
): Promise<SerializedHive> {
  await connectDB();

  const ownerId = toObjectId(input.ownerId);
  if (!ownerId) {
    throw new Error(`Invalid ownerId format: ${input.ownerId}`);
  }

  const hive = await Hive.create({
    name: input.name.trim(),
    description: input.description?.trim(),
    ownerId,
  });

  return {
    id: hive._id.toString(),
    name: hive.name,
    description: hive.description,
    ownerId: hive.ownerId.toString(),
    githubRepo: (hive.githubRepo && hive.githubRepo.owner && hive.githubRepo.repo) ? {
      owner: hive.githubRepo.owner,
      repo: hive.githubRepo.repo,
      webhookId: hive.githubRepo.webhookId,
      webhookSecret: hive.githubRepo.webhookSecret,
      connectedAt: hive.githubRepo.connectedAt
        ? (hive.githubRepo.connectedAt instanceof Date
          ? hive.githubRepo.connectedAt.toISOString()
          : new Date(hive.githubRepo.connectedAt).toISOString())
        : undefined,
      status: hive.githubRepo.status as "connected" | "disconnected",
    } : undefined,
    createdAt: hive.createdAt.toISOString(),
    updatedAt: hive.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Action: deleteHive
// Deletes a hive. Only the owner can delete. Returns true if deleted.
// ---------------------------------------------------------------------------

export async function deleteHive(
  hiveId: string,
  userId: string
): Promise<boolean> {
  await connectDB();

  const id = toObjectId(hiveId);
  const ownerId = toObjectId(userId);

  if (!id || !ownerId) return false;

  // First, verify ownership and existence
  const hive = await Hive.findOne({ _id: id, ownerId }).exec();
  if (!hive) return false;

  const session = await mongoose.startSession();
  let useTransaction = true;

  try {
    session.startTransaction();
  } catch (txErr) {
    // MongoDB standalone doesn't support transactions, fall back to non-transactional cascade delete
    useTransaction = false;
  }

  try {
    const opts = useTransaction ? { session } : {};

    // Get document IDs for deleting version history
    const docs = await Document.find({ hiveId: id }).session(useTransaction ? session : null as any).select("_id").exec();
    const docIds = docs.map(d => d._id);

    // 1. Delete Document Versions
    if (docIds.length > 0) {
      await DocumentVersion.deleteMany({ documentId: { $in: docIds } }, opts).exec();
    }

    // 2. Delete Documents
    await Document.deleteMany({ hiveId: id }, opts).exec();

    // 3. Delete Canvas Nodes & Edges
    await CanvasNode.deleteMany({ hiveId: id }, opts).exec();
    await CanvasEdge.deleteMany({ hiveId: id }, opts).exec();

    // 4. Delete Activities & Chat Messages
    await Activity.deleteMany({ hiveId: id }, opts).exec();
    await ChatMessage.deleteMany({ hiveId: id }, opts).exec();

    // 5. Delete Workflows & Workflow Runs (Execution Records)
    await Workflow.deleteMany({ hiveId: id }, opts).exec();
    await WorkflowRun.deleteMany({ hiveId: id }, opts).exec();

    // 6. Delete Agent Action Plans & Actions (Agent Proposals)
    await AgentActionPlan.deleteMany({ hiveId: id }, opts).exec();
    await AgentAction.deleteMany({ hiveId: id }, opts).exec();

    // 7. Delete Search Index Entries
    await KnowledgeIndex.deleteMany({ hiveId: id }, opts).exec();

    // 8. Delete associated intelligence snaps, recs, missions, notifications, metrics
    await HiveMindRecommendation.deleteMany({ hiveId: id }, opts).exec();
    await HiveMindSnapshot.deleteMany({ hiveId: id }, opts).exec();
    await HiveMindMission.deleteMany({ hiveId: id }, opts).exec();
    await IntelligenceNotification.deleteMany({ hiveId: id }, opts).exec();
    await SearchMetric.deleteMany({ hiveId: id }, opts).exec();
    await ChatMetric.deleteMany({ hiveId: id }, opts).exec();
    await AgentInstance.deleteMany({ hiveId: id }, opts).exec();

    // 9. Delete Hive itself
    const deleteResult = await Hive.deleteOne({ _id: id }, opts).exec();

    if (useTransaction) {
      await session.commitTransaction();
    }
    
    return deleteResult.deletedCount === 1;

  } catch (error) {
    if (useTransaction) {
      await session.abortTransaction();
    }
    console.error("[deleteHive Cascade Transaction Failed]:", error);
    throw error;
  } finally {
    session.endSession();
  }
}
