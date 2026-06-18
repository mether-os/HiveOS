import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IDocumentKnowledgeEvent {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  documentId: Types.ObjectId;
  eventType: "DocumentCreated" | "DocumentUpdated" | "DocumentVersionCreated" | "DocumentLinked" | "DocumentRestored";
  actorId: Types.ObjectId;
  actorName: string;
  metadata?: Record<string, any>; // Stores event context details (changelog, restored version, linked nodeId, etc.)
  timestamp: Date;
}

export type DocumentKnowledgeEventDocument = HydratedDocument<IDocumentKnowledgeEvent>;

const DocumentKnowledgeEventSchema = new Schema<IDocumentKnowledgeEvent>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: [true, "Hive ID is required"],
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: [true, "Document ID is required"],
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: ["DocumentCreated", "DocumentUpdated", "DocumentVersionCreated", "DocumentLinked", "DocumentRestored"],
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        ret.hiveId = ret.hiveId.toString();
        ret.documentId = ret.documentId.toString();
        ret.actorId = ret.actorId.toString();
        ret.timestamp = ret.timestamp.toISOString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Optimize sorting chronological events for ingestion
DocumentKnowledgeEventSchema.index({ hiveId: 1, timestamp: 1 });

const DocumentKnowledgeEvent =
  (mongoose.models["DocumentKnowledgeEvent"] as mongoose.Model<IDocumentKnowledgeEvent>) ||
  mongoose.model<IDocumentKnowledgeEvent>("DocumentKnowledgeEvent", DocumentKnowledgeEventSchema);

export default DocumentKnowledgeEvent;
