import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IDocument {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  nodeId?: string; // React Flow unique ID of the corresponding canvas node
  title: string;
  type: "prd" | "trd" | "architecture" | "research" | "meeting" | "spec" | "markdown";
  content: string; // Markdown text
  tags: string[];
  status: "draft" | "review" | "approved";
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentDocument = HydratedDocument<IDocument>;

const DocumentSchema = new Schema<IDocument>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: [true, "Hive ID is required"],
      index: true,
    },
    nodeId: {
      type: String,
      index: true,
      default: null,
    },
    title: {
      type: String,
      required: [true, "Document title is required"],
      trim: true,
      maxlength: 150,
    },
    type: {
      type: String,
      required: true,
      enum: ["prd", "trd", "architecture", "research", "meeting", "spec", "markdown"],
      default: "markdown",
    },
    content: {
      type: String,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["draft", "review", "approved"],
      default: "draft",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        ret.hiveId = ret.hiveId.toString();
        ret.createdBy = ret.createdBy.toString();
        ret.updatedBy = ret.updatedBy.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// MongoDB Compound Text Indexes for Weighted Fuzzy Searching
// Title (highest weight) > Tags > Content
DocumentSchema.index(
  { title: "text", tags: "text", content: "text" },
  {
    name: "document_search_text_index",
    weights: {
      title: 10,
      tags: 5,
      content: 1,
    },
  }
);

const Document =
  (mongoose.models["Document"] as mongoose.Model<IDocument>) ||
  mongoose.model<IDocument>("Document", DocumentSchema);

export default Document;
