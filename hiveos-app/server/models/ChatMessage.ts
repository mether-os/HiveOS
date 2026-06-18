import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IChatMessage {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;     // References Hive._id
  userId: Types.ObjectId;     // References User._id
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ChatMessageDocument = HydratedDocument<IChatMessage>;

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: [true, "Hive ID is required"],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    userName: {
      type: String,
      required: [true, "User name is required"],
      trim: true,
    },
    userAvatar: {
      type: String,
      trim: true,
      default: "",
    },
    text: {
      type: String,
      required: [true, "Message text is required"],
      trim: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        ret.hiveId = ret.hiveId.toString();
        ret.userId = ret.userId.toString();
        ret.createdAt = ret.createdAt.toISOString();
        ret.updatedAt = ret.updatedAt.toISOString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
// We need indexes on hiveId and createdAt.
// A compound index is perfect for retrieval (GET /api/hives/[hiveId]/chat?before=... &limit=...)
ChatMessageSchema.index({ hiveId: 1, createdAt: -1 });
ChatMessageSchema.index({ createdAt: -1 });

const ChatMessage =
  (mongoose.models["ChatMessage"] as mongoose.Model<IChatMessage>) ||
  mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);

export default ChatMessage;
