import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface ICanvasNode {
  _id: Types.ObjectId;
  id: string; // React Flow Node ID (unique per hiveId)
  hiveId: Types.ObjectId;
  type: string;
  category: 'Audience' | 'Problem' | 'Feature' | 'Goal' | 'Tech Stack' | 'Architecture' | 'Risk' | 'Document' | 'Task';
  title: string;
  description?: string;
  tags: string[];
  createdBy: Types.ObjectId;
  position: {
    x: number;
    y: number;
  };
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type CanvasNodeDocument = HydratedDocument<ICanvasNode>;

const CanvasNodeSchema = new Schema<ICanvasNode>(
  {
    id: {
      type: String,
      required: [true, "React Flow node ID is required"],
    },
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: [true, "Hive ID is required"],
      index: true,
    },
    type: {
      type: String,
      default: "customNode",
    },
    category: {
      type: String,
      required: [true, "Node category is required"],
      enum: [
        "Audience",
        "Problem",
        "Feature",
        "Goal",
        "Tech Stack",
        "Architecture",
        "Risk",
        "Document",
        "Task",
      ],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator ID is required"],
    },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.dbId = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index to ensure uniqueness of id per hiveId
CanvasNodeSchema.index({ hiveId: 1, id: 1 }, { unique: true });

const CanvasNode =
  (mongoose.models["CanvasNode"] as mongoose.Model<ICanvasNode>) ||
  mongoose.model<ICanvasNode>("CanvasNode", CanvasNodeSchema);

export default CanvasNode;
