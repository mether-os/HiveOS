import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IStructuredAuditLog {
  actorId?: Types.ObjectId;
  actorName: string;
  action: "submit" | "approve" | "reject" | "expire";
  notes?: string;
  timestamp: Date;
}

export interface IActionStep {
  stepNumber: number;
  actionType: "create_node" | "delete_node" | "update_node" | "create_edge" | "delete_edge" | "assign_owner" | "create_document" | "create_mission";
  params: Record<string, any>;
  reversibility: "reversible" | "irreversible";
  affectedEntities: Array<{ entityId: string; entityType: string; title: string }>;
  expectedImpact: string;
}

export interface IAgentActionPlan {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  recommendationId?: Types.ObjectId;
  title: string;
  description: string;
  reason: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number; // 0 to 100
  actionQualityScore: number; // 0 to 100
  status: "proposed" | "approved" | "rejected" | "expired" | "executed" | "failed";
  expiresAt: Date;
  sourceRiskIds: string[];
  sourceRecommendationIds: Types.ObjectId[];
  sourceMissionIds: Types.ObjectId[];
  sourceGapIds: string[];
  steps: IActionStep[];
  structuredAuditLogs: IStructuredAuditLog[];
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  decisionNotes?: string;
  executedBy?: Types.ObjectId;
  executedAt?: Date;
  executionLatencyMs?: number;
  executionResult?: "success" | "failed" | "partial";
  rollbackMetadata?: {
    beforeState: Record<string, any>;
    afterState: Record<string, any>;
  };
  executionDetails?: {
    entitiesCreated: Array<{ entityId: string; entityType: string; title: string }>;
    entitiesUpdated: Array<{ entityId: string; entityType: string; title: string }>;
    entitiesFailed: Array<{ stepNumber: number; error: string }>;
    executionOperations: Array<{ operation: string; entityId: string; timestamp: Date; details?: any }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export type AgentActionPlanDocument = HydratedDocument<IAgentActionPlan>;

const StructuredAuditLogSchema = new Schema<IStructuredAuditLog>({
  actorId: { type: Schema.Types.ObjectId, ref: "User", required: false },
  actorName: { type: String, required: true },
  action: { type: String, enum: ["submit", "approve", "reject", "expire"], required: true },
  notes: { type: String, required: false },
  timestamp: { type: Date, required: true, default: Date.now }
}, { _id: false });

const ActionStepSchema = new Schema<IActionStep>({
  stepNumber: { type: Number, required: true },
  actionType: { type: String, required: true, enum: ["create_node", "delete_node", "update_node", "create_edge", "delete_edge", "assign_owner", "create_document", "create_mission"] },
  params: { type: Schema.Types.Mixed, required: true, default: {} },
  reversibility: { type: String, enum: ["reversible", "irreversible"], required: true, default: "reversible" },
  affectedEntities: [
    {
      entityId: { type: String, required: true },
      entityType: { type: String, required: true },
      title: { type: String, required: true }
    }
  ],
  expectedImpact: { type: String, required: true }
}, { _id: false });

const AgentActionPlanSchema = new Schema<IAgentActionPlan>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true
    },
    recommendationId: {
      type: Schema.Types.ObjectId,
      ref: "HiveMindRecommendation",
      required: false
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1.0
    },
    riskLevel: {
      type: String,
      required: true,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 50
    },
    actionQualityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 50
    },
    status: {
      type: String,
      required: true,
      enum: ["proposed", "approved", "rejected", "expired", "executed", "failed"],
      default: "proposed",
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    sourceRiskIds: {
      type: [String],
      default: []
    },
    sourceRecommendationIds: {
      type: [Schema.Types.ObjectId],
      ref: "HiveMindRecommendation",
      default: []
    },
    sourceMissionIds: {
      type: [Schema.Types.ObjectId],
      ref: "HiveMindMission",
      default: []
    },
    sourceGapIds: {
      type: [String],
      default: []
    },
    steps: {
      type: [ActionStepSchema],
      default: []
    },
    structuredAuditLogs: {
      type: [StructuredAuditLogSchema],
      default: []
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    approvedAt: {
      type: Date,
      required: false
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    rejectedAt: {
      type: Date,
      required: false
    },
    decisionNotes: {
      type: String,
      required: false
    },
    executedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    executedAt: {
      type: Date,
      required: false
    },
    executionLatencyMs: {
      type: Number,
      required: false
    },
    executionResult: {
      type: String,
      enum: ["success", "failed", "partial"],
      required: false
    },
    rollbackMetadata: {
      beforeState: {
        type: Schema.Types.Mixed,
        default: {}
      },
      afterState: {
        type: Schema.Types.Mixed,
        default: {}
      }
    },
    executionDetails: {
      entitiesCreated: [
        {
          entityId: { type: String, required: true },
          entityType: { type: String, required: true },
          title: { type: String, required: true }
        }
      ],
      entitiesUpdated: [
        {
          entityId: { type: String, required: true },
          entityType: { type: String, required: true },
          title: { type: String, required: true }
        }
      ],
      entitiesFailed: [
        {
          stepNumber: { type: Number, required: true },
          error: { type: String, required: true }
        }
      ],
      executionOperations: [
        {
          operation: { type: String, required: true },
          entityId: { type: String, required: true },
          timestamp: { type: Date, required: true, default: Date.now },
          details: { type: Schema.Types.Mixed }
        }
      ]
    }
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
        if (ret.rejectedBy) ret.rejectedBy = ret.rejectedBy.toString();
        if (ret.executedBy) ret.executedBy = ret.executedBy.toString();
        if (ret.sourceRecommendationIds) ret.sourceRecommendationIds = ret.sourceRecommendationIds.map((id: any) => id.toString());
        if (ret.sourceMissionIds) ret.sourceMissionIds = ret.sourceMissionIds.map((id: any) => id.toString());
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Indexes to speed up listing and expiration runs
AgentActionPlanSchema.index({ hiveId: 1, status: 1 });

const AgentActionPlan =
  (mongoose.models["AgentActionPlan"] as mongoose.Model<IAgentActionPlan>) ||
  mongoose.model<IAgentActionPlan>("AgentActionPlan", AgentActionPlanSchema);

export default AgentActionPlan;
