import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IRelatedEntity {
  entityId: string;
  entityType: "node" | "document" | "activity" | "mutation";
  title: string;
}

export interface IHiveMindRecommendation {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  type: "document" | "relationship" | "task" | "architecture" | "owner";
  title: string;
  reason: string;
  confidence: number;
  relatedEntities: IRelatedEntity[];
  status: "active" | "accepted" | "dismissed" | "completed";
  suggestedActions: string[];
  sourceNodes: string[];
  sourceDocuments: string[];
  sourceActivities: string[];
  sourceType: "graph" | "document" | "activity" | "hybrid";
  sourceCount: number;
  acceptedAt?: Date;
  dismissedAt?: Date;
  completedAt?: Date;
  completedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type HiveMindRecommendationDocument = HydratedDocument<IHiveMindRecommendation>;

const HiveMindRecommendationSchema = new Schema<IHiveMindRecommendation>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["document", "relationship", "task", "architecture", "owner"],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    relatedEntities: [
      {
        entityId: { type: String, required: true },
        entityType: {
          type: String,
          required: true,
          enum: ["node", "document", "activity", "mutation"],
        },
        title: { type: String, required: true },
      },
    ],
    status: {
      type: String,
      required: true,
      enum: ["active", "accepted", "dismissed", "completed"],
      default: "active",
      index: true,
    },
    suggestedActions: {
      type: [String],
      default: [],
    },
    sourceNodes: {
      type: [String],
      default: [],
    },
    sourceDocuments: {
      type: [String],
      default: [],
    },
    sourceActivities: {
      type: [String],
      default: [],
    },
    sourceType: {
      type: String,
      required: true,
      enum: ["graph", "document", "activity", "hybrid"],
      default: "graph",
    },
    sourceCount: {
      type: Number,
      required: true,
      default: 0,
    },
    acceptedAt: {
      type: Date,
      required: false,
    },
    dismissedAt: {
      type: Date,
      required: false,
    },
    completedAt: {
      type: Date,
      required: false,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        ret.hiveId = ret.hiveId.toString();
        if (ret.completedBy) ret.completedBy = ret.completedBy.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Optimize retrieval of active recommendations per workspace
HiveMindRecommendationSchema.index({ hiveId: 1, status: 1 });

const HiveMindRecommendation =
  (mongoose.models["HiveMindRecommendation"] as mongoose.Model<IHiveMindRecommendation>) ||
  mongoose.model<IHiveMindRecommendation>("HiveMindRecommendation", HiveMindRecommendationSchema);

export default HiveMindRecommendation;
