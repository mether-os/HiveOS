import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IActivityGraphLink {
  nodeId: string;
  source: "regex_hashtag" | "keyword_heuristic" | "manual";
  confidence: number;
}

export interface IActivity {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  type: string; // e.g. "github_commit", "github_pr_open", "github_pr_merge", "github_issue_open", etc.
  title: string;
  description?: string;
  actorName: string;
  actorAvatar?: string;
  graphLinks?: IActivityGraphLink[];
  timestamp: Date;
}

export type ActivityDocument = HydratedDocument<IActivity>;

const ActivitySchema = new Schema<IActivity>(
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
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    actorAvatar: {
      type: String,
      trim: true,
    },
    graphLinks: {
      type: [{
        nodeId: { type: String, required: true },
        source: { type: String, enum: ["regex_hashtag", "keyword_heuristic", "manual"], required: true },
        confidence: { type: Number, required: true }
      }],
      default: []
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
        ret.timestamp = ret.timestamp.toISOString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index to efficiently retrieve activities per hiveId, sorted by timestamp descending
ActivitySchema.index({ hiveId: 1, timestamp: -1 });

const Activity =
  (mongoose.models["Activity"] as mongoose.Model<IActivity>) ||
  mongoose.model<IActivity>("Activity", ActivitySchema);

export default Activity;
