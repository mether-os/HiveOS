import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IDocumentVersion {
  _id: Types.ObjectId;
  documentId: Types.ObjectId;
  version: number; // Incrementing counter (1, 2, 3...)
  title: string;
  content: string;
  authorId: Types.ObjectId;
  authorName: string;
  changelog?: string;
  timestamp: Date;
}

export type DocumentVersionDocument = HydratedDocument<IDocumentVersion>;

const DocumentVersionSchema = new Schema<IDocumentVersion>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: [true, "Document ID is required"],
      index: true,
    },
    version: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      default: "",
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    changelog: {
      type: String,
      trim: true,
      default: "",
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
        ret.documentId = ret.documentId.toString();
        ret.authorId = ret.authorId.toString();
        ret.timestamp = ret.timestamp.toISOString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index to ensure uniqueness of version number per document and quick sorted lookup
DocumentVersionSchema.index({ documentId: 1, version: -1 }, { unique: true });

const DocumentVersion =
  (mongoose.models["DocumentVersion"] as mongoose.Model<IDocumentVersion>) ||
  mongoose.model<IDocumentVersion>("DocumentVersion", DocumentVersionSchema);

export default DocumentVersion;
