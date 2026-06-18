import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IGithubEvent {
  _id: Types.ObjectId;
  deliveryId: string;
  hiveId: Types.ObjectId;
  eventType: string;
  action?: string;
  payload: Record<string, any>;
  timestamp: Date;
}

export type GithubEventDocument = HydratedDocument<IGithubEvent>;

const GithubEventSchema = new Schema<IGithubEvent>(
  {
    deliveryId: {
      type: String,
      required: true,
      index: true,
    },
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    action: {
      type: String,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        ret.hiveId = ret.hiveId.toString();
        ret.timestamp = ret.timestamp.toISOString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index to help query events per hiveId sorted by timestamp
GithubEventSchema.index({ hiveId: 1, timestamp: -1 });

const GithubEvent =
  (mongoose.models["GithubEvent"] as mongoose.Model<IGithubEvent>) ||
  mongoose.model<IGithubEvent>("GithubEvent", GithubEventSchema);

export default GithubEvent;
