import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IAgentAction {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  recommendationId?: Types.ObjectId;
  actionType: "create_node" | "delete_node" | "update_node" | "create_edge" | "delete_edge" | "assign_owner" | "create_document";
  params: Record<string, any>;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "pending_approval" | "approved" | "rejected" | "executed" | "failed";
  requestedBy: string; // identifier of the agent/service requesting this action
  approvedBy?: Types.ObjectId; // User ID who approved the action
  approvedAt?: Date;
  executedAt?: Date;
  error?: string;
  auditLogs: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type AgentActionDocument = HydratedDocument<IAgentAction>;

const AgentActionSchema = new Schema<IAgentAction>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true,
    },
    recommendationId: {
      type: Schema.Types.ObjectId,
      ref: "HiveMindRecommendation",
      required: false,
    },
    actionType: {
      type: String,
      required: true,
      enum: ["create_node", "delete_node", "update_node", "create_edge", "delete_edge", "assign_owner", "create_document"],
    },
    params: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    riskLevel: {
      type: String,
      required: true,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      required: true,
      enum: ["pending_approval", "approved", "rejected", "executed", "failed"],
      default: "pending_approval",
      index: true,
    },
    requestedBy: {
      type: String,
      required: true,
      trim: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    approvedAt: {
      type: Date,
      required: false,
    },
    executedAt: {
      type: Date,
      required: false,
    },
    error: {
      type: String,
      required: false,
    },
    auditLogs: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        ret.hiveId = ret.hiveId.toString();
        if (ret.recommendationId) ret.recommendationId = ret.recommendationId.toString();
        if (ret.approvedBy) ret.approvedBy = ret.approvedBy.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for rapid lookups of pending proposals in workspace
AgentActionSchema.index({ hiveId: 1, status: 1 });

const AgentAction =
  (mongoose.models["AgentAction"] as mongoose.Model<IAgentAction>) ||
  mongoose.model<IAgentAction>("AgentAction", AgentActionSchema);

export default AgentAction;
