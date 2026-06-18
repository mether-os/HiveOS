import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IChatMetric {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  query: string;
  answer: string;
  mode: "analyst" | "architect" | "product" | "risk";
  questionCategory: string;
  citedSourcesCount: number;
  suggestionsCount: number;
  acceptedSuggestionsCount: number;
  latencyMs: number;
  validationSuccess: boolean;
  timestamp: Date;
}

export type ChatMetricDocument = HydratedDocument<IChatMetric>;

const ChatMetricSchema = new Schema<IChatMetric>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true
    },
    query: {
      type: String,
      required: true,
      trim: true
    },
    answer: {
      type: String,
      required: true
    },
    mode: {
      type: String,
      enum: ["analyst", "architect", "product", "risk"],
      required: true,
      default: "analyst"
    },
    questionCategory: {
      type: String,
      required: true,
      default: "general"
    },
    citedSourcesCount: {
      type: Number,
      required: true,
      default: 0
    },
    suggestionsCount: {
      type: Number,
      required: true,
      default: 0
    },
    acceptedSuggestionsCount: {
      type: Number,
      required: true,
      default: 0
    },
    latencyMs: {
      type: Number,
      required: true
    },
    validationSuccess: {
      type: Boolean,
      required: true,
      default: true
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    }
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
      }
    }
  }
);

ChatMetricSchema.index({ hiveId: 1, timestamp: -1 });

const ChatMetric =
  (mongoose.models["ChatMetric"] as mongoose.Model<IChatMetric>) ||
  mongoose.model<IChatMetric>("ChatMetric", ChatMetricSchema);

export default ChatMetric;
