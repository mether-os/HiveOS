import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IKnowledgeIndex {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  entityId: string; // Original ID of the node, document, activity, or mutation
  entityType: "node" | "document" | "activity" | "mutation";
  title: string;
  content: string; // Flattened text content
  tags: string[];
  status?: string;
  metadata: Record<string, any>; // Arbitrary context details (PR state, author, category, etc.)
  sourceUpdatedAt: Date; // Freshness tracker for AI/sync engines
  createdAt: Date;
  updatedAt: Date;
}

export type KnowledgeIndexDocument = HydratedDocument<IKnowledgeIndex>;

const KnowledgeIndexSchema = new Schema<IKnowledgeIndex>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ["node", "document", "activity", "mutation"],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    status: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sourceUpdatedAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        ret.hiveId = ret.hiveId.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Enforce single index entry per entity to prevent search duplications on updates
KnowledgeIndexSchema.index({ entityId: 1 }, { unique: true });

// Text search compound index with weighted ranking
KnowledgeIndexSchema.index(
  { title: "text", tags: "text", content: "text" },
  {
    name: "knowledge_index_search_text",
    weights: {
      title: 10,
      tags: 5,
      content: 1,
    },
  }
);

const KnowledgeIndex =
  (mongoose.models["KnowledgeIndex"] as mongoose.Model<IKnowledgeIndex>) ||
  mongoose.model<IKnowledgeIndex>("KnowledgeIndex", KnowledgeIndexSchema);

export default KnowledgeIndex;
