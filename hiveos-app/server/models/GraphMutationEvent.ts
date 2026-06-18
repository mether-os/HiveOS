import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IGraphMutationEvent {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  eventType: "node_created" | "node_updated" | "node_deleted" | "edge_created" | "edge_updated" | "edge_deleted";
  entityId: string; // React Flow unique ID of the node or edge
  entityType: "node" | "edge";
  actorId: Types.ObjectId; // References User._id
  actorName: string;
  previousState?: Record<string, any> | null; // State before mutation (null for created)
  nextState?: Record<string, any> | null;     // State after mutation (null for deleted)
  timestamp: Date;
}

export type GraphMutationEventDocument = HydratedDocument<IGraphMutationEvent>;

const GraphMutationEventSchema = new Schema<IGraphMutationEvent>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: [true, "Hive ID is required"],
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: ["node_created", "node_updated", "node_deleted", "edge_created", "edge_updated", "edge_deleted"],
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ["node", "edge"],
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Actor ID is required"],
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    previousState: {
      type: Schema.Types.Mixed,
      default: null,
    },
    nextState: {
      type: Schema.Types.Mixed,
      default: null,
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
        ret.actorId = ret.actorId.toString();
        ret.timestamp = ret.timestamp.toISOString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for loading mutation logs chronologically for a hive
GraphMutationEventSchema.index({ hiveId: 1, timestamp: 1 });

const GraphMutationEvent =
  (mongoose.models["GraphMutationEvent"] as mongoose.Model<IGraphMutationEvent>) ||
  mongoose.model<IGraphMutationEvent>("GraphMutationEvent", GraphMutationEventSchema);

export default GraphMutationEvent;
