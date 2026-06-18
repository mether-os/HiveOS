import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";
import { IRelatedEntity } from "./HiveMindRecommendation";

export interface IHiveMindMission {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  title: string;
  description: string;
  type: string; // e.g. "assign_owner", "link_prd", "resolve_cycle"
  relatedEntities: IRelatedEntity[];
  status: "pending" | "assigned" | "completed" | "reviewed";
  generatedAt: Date;
  completedAt?: Date;
  assignedTo?: Types.ObjectId;
  assigneeName?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  generatedBy: "system" | "llm";
  sourceRisk?: string;
  sourceRecommendation?: string;
  sourceGap?: string;
}

export type HiveMindMissionDocument = HydratedDocument<IHiveMindMission>;

const HiveMindMissionSchema = new Schema<IHiveMindMission>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
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
      enum: ["pending", "assigned", "completed", "reviewed"],
      default: "pending",
      index: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    assigneeName: {
      type: String,
      required: false,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    reviewedAt: {
      type: Date,
      required: false,
    },
    reviewNotes: {
      type: String,
      required: false,
    },
    generatedBy: {
      type: String,
      required: true,
      enum: ["system", "llm"],
      default: "system",
    },
    sourceRisk: {
      type: String,
      required: false,
    },
    sourceRecommendation: {
      type: String,
      required: false,
    },
    sourceGap: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        ret.hiveId = ret.hiveId.toString();
        if (ret.assignedTo) ret.assignedTo = ret.assignedTo.toString();
        if (ret.reviewedBy) ret.reviewedBy = ret.reviewedBy.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index to fetch mission stats and active daily checklists
HiveMindMissionSchema.index({ hiveId: 1, generatedAt: -1 });

const HiveMindMission =
  (mongoose.models["HiveMindMission"] as mongoose.Model<IHiveMindMission>) ||
  mongoose.model<IHiveMindMission>("HiveMindMission", HiveMindMissionSchema);

export default HiveMindMission;
