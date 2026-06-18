import mongoose, { type HydratedDocument, Schema } from "mongoose";

export interface IProcessedWebhookEvent {
  deliveryId: string;
  processedAt: Date;
}

export type ProcessedWebhookEventDocument = HydratedDocument<IProcessedWebhookEvent>;

const ProcessedWebhookEventSchema = new Schema<IProcessedWebhookEvent>(
  {
    deliveryId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 30, // 30 days TTL in seconds (automatically deletes older records)
    },
  },
  {
    timestamps: false,
  }
);

const ProcessedWebhookEvent =
  (mongoose.models["ProcessedWebhookEvent"] as mongoose.Model<IProcessedWebhookEvent>) ||
  mongoose.model<IProcessedWebhookEvent>("ProcessedWebhookEvent", ProcessedWebhookEventSchema);

export default ProcessedWebhookEvent;
