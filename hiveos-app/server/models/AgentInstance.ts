import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IAgentInstance {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  agentId: string; // "architect" | "product" | "documentation" | "pm" | "risk"
  status: "active" | "inactive";
  riskLevel: "low" | "medium" | "high" | "critical";
  metrics: {
    proposalsGenerated: number;
    proposalsApproved: number;
    proposalsRejected: number;
    workflowSuccessCount: number;
    workflowFailureCount: number;
    totalConfidence: number;
    proposalEffectivenessScore: number;
  };
  overrides: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentInstanceDocument = HydratedDocument<IAgentInstance>;

const AgentInstanceSchema = new Schema<IAgentInstance>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true
    },
    agentId: {
      type: String,
      required: true,
      enum: ["architect", "product", "documentation", "pm", "risk"]
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      required: true,
      default: "active"
    },
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      default: "medium"
    },
    metrics: {
      proposalsGenerated: { type: Number, required: true, default: 0 },
      proposalsApproved: { type: Number, required: true, default: 0 },
      proposalsRejected: { type: Number, required: true, default: 0 },
      workflowSuccessCount: { type: Number, required: true, default: 0 },
      workflowFailureCount: { type: Number, required: true, default: 0 },
      totalConfidence: { type: Number, required: true, default: 0 },
      proposalEffectivenessScore: { type: Number, required: true, default: 0 }
    },
    overrides: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    }
  },
  {
    timestamps: true,
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

// Compound index to ensure one instance per agent per hive
AgentInstanceSchema.index({ hiveId: 1, agentId: 1 }, { unique: true });

const AgentInstance =
  (mongoose.models["AgentInstance"] as mongoose.Model<IAgentInstance>) ||
  mongoose.model<IAgentInstance>("AgentInstance", AgentInstanceSchema);

export default AgentInstance;
