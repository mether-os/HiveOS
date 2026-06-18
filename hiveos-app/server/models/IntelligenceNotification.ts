import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IIntelligenceNotification {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  type: "new_risk" | "stale_work" | "missing_ownership" | "dependency_issue";
  fingerprint: string; // unique hash or descriptor to deduplicate notification instances
  title: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  read: boolean;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  occurrenceCount: number;
}

export type IntelligenceNotificationDocument = HydratedDocument<IIntelligenceNotification>;

const IntelligenceNotificationSchema = new Schema<IIntelligenceNotification>(
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
      enum: ["new_risk", "stale_work", "missing_ownership", "dependency_issue"],
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    read: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    firstDetectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastDetectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    occurrenceCount: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    timestamps: false,
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

// Enforce compound index to easily check active unread notifications by fingerprint
IntelligenceNotificationSchema.index({ hiveId: 1, fingerprint: 1, read: 1 });

const IntelligenceNotification =
  (mongoose.models["IntelligenceNotification"] as mongoose.Model<IIntelligenceNotification>) ||
  mongoose.model<IIntelligenceNotification>("IntelligenceNotification", IntelligenceNotificationSchema);

export default IntelligenceNotification;
