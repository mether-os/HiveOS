import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface ISearchMetric {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  query: string;
  latencyMs: number;
  resultsCount: number;
  timestamp: Date;
}

export type SearchMetricDocument = HydratedDocument<ISearchMetric>;

const SearchMetricSchema = new Schema<ISearchMetric>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true,
    },
    query: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    latencyMs: {
      type: Number,
      required: true,
    },
    resultsCount: {
      type: Number,
      required: true,
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
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Optimize metrics charts fetches
SearchMetricSchema.index({ hiveId: 1, timestamp: -1 });

const SearchMetric =
  (mongoose.models["SearchMetric"] as mongoose.Model<ISearchMetric>) ||
  mongoose.model<ISearchMetric>("SearchMetric", SearchMetricSchema);

export default SearchMetric;
