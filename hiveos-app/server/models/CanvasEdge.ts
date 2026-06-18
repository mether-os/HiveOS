import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface ICanvasEdge {
  _id: Types.ObjectId;
  id: string; // React Flow edge ID (unique per hiveId)
  hiveId: Types.ObjectId;
  source: string; // React Flow source node ID
  target: string; // React Flow target node ID
  type: string; // React Flow edge type
  relationType?: "depends_on" | "implements" | "relates_to" | "blocks" | "documents" | "owns" | "uses" | "generates";
  data?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type CanvasEdgeDocument = HydratedDocument<ICanvasEdge>;

const CanvasEdgeSchema = new Schema<ICanvasEdge>(
  {
    id: {
      type: String,
      required: [true, "React Flow edge ID is required"],
    },
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: [true, "Hive ID is required"],
      index: true,
    },
    source: {
      type: String,
      required: [true, "Source node ID is required"],
    },
    target: {
      type: String,
      required: [true, "Target node ID is required"],
    },
    type: {
      type: String,
      default: "smoothstep",
    },
    relationType: {
      type: String,
      enum: ["depends_on", "implements", "relates_to", "blocks", "documents", "owns", "uses", "generates"],
      default: "relates_to",
      index: true,
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
CanvasEdgeSchema.index({ hiveId: 1, id: 1 }, { unique: true });

const CanvasEdge =
  (mongoose.models["CanvasEdge"] as mongoose.Model<ICanvasEdge>) ||
  mongoose.model<ICanvasEdge>("CanvasEdge", CanvasEdgeSchema);

export default CanvasEdge;
