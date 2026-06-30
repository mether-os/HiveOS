/**
 * server/models/Hive.ts — Mongoose Hive (Workspace) Schema
 *
 * Purpose: Defines the MongoDB document structure for a Hive workspace.
 * A Hive is the core entity of HiveOS — every project lives inside one.
 *
 * Schema decisions:
 *
 * 1. `ownerId` as ObjectId ref — not embedded user data.
 *    Why? Embedding user data (name, avatar) would cause data staleness if
 *    the user updates their profile. The ref allows us to $lookup or populate
 *    fresh user data on demand.
 *
 * 2. Minimal schema for V1.
 *    Fields like `members`, `githubRepo`, `settings`, `canvas` are
 *    intentionally omitted. They will be added in subsequent phases.
 *    The schema is designed to be extended, not rewritten.
 *
 * 3. `description` is optional.
 *    Users should be able to create a Hive with just a name. Description
 *    can be added/edited later.
 *
 * Future additions (documented here for engineers joining the project):
 * - members: [{ userId, role: 'leader' | 'member', joinedAt }]
 * - githubRepo: { repoId, repoUrl, webhookId, connectedAt }
 * - settings: { aiEnabled, dailyMissionsEnabled, standupTime }
 * - canvasId: ObjectId (ref to Canvas collection)
 *
 * Interactions:
 * - Used by: server/actions/hives.ts (CRUD operations)
 * - Referenced by: app/api/hives/route.ts, app/api/hives/[hiveId]/route.ts
 * - Never imported by: client components
 */

import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

// ---------------------------------------------------------------------------
// TypeScript Interface
// ---------------------------------------------------------------------------

export interface IHive {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  ownerId: Types.ObjectId; // References User._id
  githubRepo?: {
    owner: string;
    repo: string;
    webhookId?: string;
    webhookSecret?: string;
    connectedAt?: Date;
    status: "connected" | "disconnected";
  };
  createdAt: Date;
  updatedAt: Date;
}

export type HiveDocument = HydratedDocument<IHive>;

// ---------------------------------------------------------------------------
// Serialized representation for API responses and client state.
// This is what leaves the server — ObjectIds become strings.
// ---------------------------------------------------------------------------
export interface SerializedHive {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  githubRepo?: {
    owner: string;
    repo: string;
    webhookId?: string;
    connectedAt?: string;
    status: "connected" | "disconnected";
  };
  createdAt: string; // ISO date string — safe for JSON serialization
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
const HIVE_NAME_MAX = 50;
const HIVE_DESCRIPTION_MAX = 500;

// ---------------------------------------------------------------------------
// Schema Definition
// ---------------------------------------------------------------------------

const HiveSchema = new Schema<IHive>(
  {
    name: {
      type: String,
      required: [true, "Hive name is required"],
      trim: true,
      minlength: [1, "Name cannot be empty"],
      maxlength: [
        HIVE_NAME_MAX,
        `Name cannot exceed ${HIVE_NAME_MAX} characters`,
      ],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [
        HIVE_DESCRIPTION_MAX,
        `Description cannot exceed ${HIVE_DESCRIPTION_MAX} characters`,
      ],
    },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner is required"],
    },

    githubRepo: {
      owner: { type: String, trim: true },
      repo: { type: String, trim: true },
      webhookId: { type: String, trim: true },
      webhookSecret: { type: String, trim: true },
      connectedAt: { type: Date },
      status: {
        type: String,
        enum: ["connected", "disconnected"],
        default: "disconnected",
      },
    },
  },
  {
    timestamps: true, // Adds createdAt, updatedAt automatically

    toJSON: {
      virtuals: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        ret.ownerId = ret.ownerId.toString();
        ret.createdAt = ret.createdAt.toISOString();
        ret.updatedAt = ret.updatedAt.toISOString();
        if (ret.githubRepo) {
          delete ret.githubRepo.webhookSecret;
          if (ret.githubRepo.connectedAt) {
            ret.githubRepo.connectedAt = ret.githubRepo.connectedAt instanceof Date 
              ? ret.githubRepo.connectedAt.toISOString() 
              : new Date(ret.githubRepo.connectedAt).toISOString();
          }
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ---------------------------------------------------------------------------
// Compound index: efficiently query "all hives for user X, newest first"
// This is the primary query pattern for the dashboard.
// ---------------------------------------------------------------------------
HiveSchema.index({ ownerId: 1, createdAt: -1 });

// ---------------------------------------------------------------------------
// Model Registration (hot-reload safe)
// ---------------------------------------------------------------------------
const Hive =
  (mongoose.models["Hive"] as mongoose.Model<IHive>) ||
  mongoose.model<IHive>("Hive", HiveSchema);

export default Hive;
