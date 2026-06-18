import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IWorkflowRunStep {
  stepNumber: number;
  actionType: string;
  params: Record<string, any>;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  executedAt?: Date;
  error?: string;
  actionPlanId?: Types.ObjectId;
}

export interface IWorkflowRunLog {
  timestamp: Date;
  message: string;
  severity: "info" | "warn" | "error";
}

export interface IWorkflowRunMetrics {
  estimatedHealthImpact: number;
  estimatedMomentumImpact: number;
  executionComplexity: number;
  estimatedDuration: number;
  estimatedPlansCount: number;
  estimatedExecutionsCount: number;
  estimatedApprovalsCount: number;
}

export interface IWorkflowRun {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  workflowId: Types.ObjectId;
  name: string;
  status: "proposed" | "approved" | "blocked" | "active" | "paused" | "completed" | "failed";
  currentStepIndex: number;
  steps: IWorkflowRunStep[];
  parentWorkflowId?: Types.ObjectId;
  parentRunId?: Types.ObjectId;
  spawnedActionPlans: Types.ObjectId[];
  triggerFingerprint?: string;
  firstTriggeredAt: Date;
  lastTriggeredAt: Date;
  occurrenceCount: number;
  workflowRiskLevel: "low" | "medium" | "high" | "critical";
  proposedBy?: Types.ObjectId;
  proposedByAgentId?: string;
  agentExplainability?: {
    reasoning: string;
    sourceEntities: string[];
    sourceDocuments: string[];
    sourceActivities: string[];
    sourceWorkflows: string[];
    sourceRecommendations: string[];
    sourceRisks: string[];
    sourceMissions: string[];
    confidence: number;
    confidenceBreakdown: {
      sourceCount: number;
      graphEvidence: boolean;
      ruleAgreement: boolean;
      historicalEffectiveness: number;
    };
  };
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  activatedBy?: Types.ObjectId;
  activatedAt?: Date;
  completedAt?: Date;
  executionDurationMs?: number;
  logs: IWorkflowRunLog[];
  metrics: IWorkflowRunMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkflowRunDocument = HydratedDocument<IWorkflowRun>;

const WorkflowRunStepSchema = new Schema<IWorkflowRunStep>({
  stepNumber: { type: Number, required: true },
  actionType: { type: String, required: true },
  params: { type: Schema.Types.Mixed, required: true, default: {} },
  status: {
    type: String,
    enum: ["pending", "running", "completed", "failed", "skipped"],
    required: true,
    default: "pending"
  },
  executedAt: { type: Date, required: false },
  error: { type: String, required: false },
  actionPlanId: { type: Schema.Types.ObjectId, ref: "AgentActionPlan", required: false }
}, { _id: false });

const WorkflowRunLogSchema = new Schema<IWorkflowRunLog>({
  timestamp: { type: Date, required: true, default: Date.now },
  message: { type: String, required: true },
  severity: { type: String, enum: ["info", "warn", "error"], required: true, default: "info" }
}, { _id: false });

const WorkflowRunMetricsSchema = new Schema<IWorkflowRunMetrics>({
  estimatedHealthImpact: { type: Number, required: true, default: 0 },
  estimatedMomentumImpact: { type: Number, required: true, default: 0 },
  executionComplexity: { type: Number, required: true, default: 0 },
  estimatedDuration: { type: Number, required: true, default: 0 },
  estimatedPlansCount: { type: Number, required: true, default: 0 },
  estimatedExecutionsCount: { type: Number, required: true, default: 0 },
  estimatedApprovalsCount: { type: Number, required: true, default: 0 }
}, { _id: false });

const WorkflowRunSchema = new Schema<IWorkflowRun>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true
    },
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["proposed", "approved", "blocked", "active", "paused", "completed", "failed"],
      required: true,
      default: "proposed",
      index: true
    },
    currentStepIndex: {
      type: Number,
      required: true,
      default: 0
    },
    steps: {
      type: [WorkflowRunStepSchema],
      required: true,
      default: []
    },
    parentWorkflowId: {
      type: Schema.Types.ObjectId,
      ref: "Workflow",
      required: false
    },
    parentRunId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowRun",
      required: false
    },
    spawnedActionPlans: {
      type: [Schema.Types.ObjectId],
      ref: "AgentActionPlan",
      required: true,
      default: []
    },
    triggerFingerprint: {
      type: String,
      required: false,
      index: true
    },
    firstTriggeredAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    lastTriggeredAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    occurrenceCount: {
      type: Number,
      required: true,
      default: 1
    },
    workflowRiskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      required: true,
      default: "medium"
    },
    proposedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    proposedByAgentId: {
      type: String,
      required: false
    },
    agentExplainability: {
      reasoning: { type: String, required: false },
      sourceEntities: { type: [String], default: [] },
      sourceDocuments: { type: [String], default: [] },
      sourceActivities: { type: [String], default: [] },
      sourceWorkflows: { type: [String], default: [] },
      sourceRecommendations: { type: [String], default: [] },
      sourceRisks: { type: [String], default: [] },
      sourceMissions: { type: [String], default: [] },
      confidence: { type: Number, required: false },
      confidenceBreakdown: {
        sourceCount: { type: Number, required: false },
        graphEvidence: { type: Boolean, required: false },
        ruleAgreement: { type: Boolean, required: false },
        historicalEffectiveness: { type: Number, required: false }
      }
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
    activatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    activatedAt: {
      type: Date,
      required: false
    },
    completedAt: {
      type: Date,
      required: false
    },
    executionDurationMs: {
      type: Number,
      required: false
    },
    logs: {
      type: [WorkflowRunLogSchema],
      required: true,
      default: []
    },
    metrics: {
      type: WorkflowRunMetricsSchema,
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
        ret.workflowId = ret.workflowId.toString();
        if (ret.parentWorkflowId) ret.parentWorkflowId = ret.parentWorkflowId.toString();
        if (ret.parentRunId) ret.parentRunId = ret.parentRunId.toString();
        if (ret.spawnedActionPlans) ret.spawnedActionPlans = ret.spawnedActionPlans.map((id: any) => id.toString());
        if (ret.proposedBy) ret.proposedBy = ret.proposedBy.toString();
        if (ret.approvedBy) ret.approvedBy = ret.approvedBy.toString();
        if (ret.activatedBy) ret.activatedBy = ret.activatedBy.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

WorkflowRunSchema.index({ hiveId: 1, status: 1 });

const WorkflowRun =
  (mongoose.models["WorkflowRun"] as mongoose.Model<IWorkflowRun>) ||
  mongoose.model<IWorkflowRun>("WorkflowRun", WorkflowRunSchema);

export default WorkflowRun;
