import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IHiveMindSnapshot {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  healthScore: number;
  risksCount: number;
  gapsCount: number;
  recommendationsCount: number;
  acceptedRecommendationsCount: number;
  completedRecommendationsCount: number;
  dismissedRecommendationsCount: number;
  missionsCompletionRate: number;
  momentumScore: number;
  risks: any[];
  recommendations: any[];
  gaps: any[];
  missions: any[];
  promptVersion?: string;
  schemaVersion?: string;
  llmMetrics?: {
    contextSizeTokens: number;
    promptSizeTokens: number;
    responseLatencyMs: number;
    tokenUsage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    fallbackActive: boolean;
    error?: string;
  };
  timestamp: Date;
}

export type HiveMindSnapshotDocument = HydratedDocument<IHiveMindSnapshot>;

const HiveMindSnapshotSchema = new Schema<IHiveMindSnapshot>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true,
    },
    healthScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    risksCount: {
      type: Number,
      required: true,
      default: 0,
    },
    gapsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    recommendationsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    acceptedRecommendationsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    completedRecommendationsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    dismissedRecommendationsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    missionsCompletionRate: {
      type: Number,
      required: true,
      default: 0,
    },
    momentumScore: {
      type: Number,
      required: true,
      default: 100,
    },
    risks: {
      type: [Schema.Types.Mixed],
      default: [],
    } as any,
    recommendations: {
      type: [Schema.Types.Mixed],
      default: [],
    } as any,
    gaps: {
      type: [Schema.Types.Mixed],
      default: [],
    } as any,
    missions: {
      type: [Schema.Types.Mixed],
      default: [],
    } as any,
    promptVersion: {
      type: String,
      required: false,
    },
    schemaVersion: {
      type: String,
      required: false,
    },
    llmMetrics: {
      type: {
        contextSizeTokens: Number,
        promptSizeTokens: Number,
        responseLatencyMs: Number,
        tokenUsage: {
          promptTokens: Number,
          completionTokens: Number,
          totalTokens: Number,
        },
        fallbackActive: Boolean,
        error: String,
      },
      required: false,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
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

// Optimize trend chart queries (fetching last N snapshots sorted by timestamp)
HiveMindSnapshotSchema.index({ hiveId: 1, timestamp: -1 });

const HiveMindSnapshot =
  (mongoose.models["HiveMindSnapshot"] as mongoose.Model<IHiveMindSnapshot>) ||
  mongoose.model<IHiveMindSnapshot>("HiveMindSnapshot", HiveMindSnapshotSchema);

export default HiveMindSnapshot;
