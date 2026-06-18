import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

export interface IWorkflowStep {
  stepNumber: number;
  actionType: "generate_action_plan" | "execute_action_plan" | "notify_user" | "request_approval";
  params: Record<string, any>;
}

export interface IWorkflow {
  _id: Types.ObjectId;
  hiveId: Types.ObjectId;
  name: string;
  description: string;
  trigger: {
    type: "manual" | "mission_completion" | "risk_resolved" | "recommendation_accepted" | "health_score_threshold" | "schedule";
    params: Record<string, any>;
  };
  steps: IWorkflowStep[];
  status: "active" | "paused" | "inactive";
  createdBy?: Types.ObjectId;
  isTemplate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkflowDocument = HydratedDocument<IWorkflow>;

const WorkflowStepSchema = new Schema<IWorkflowStep>({
  stepNumber: { type: Number, required: true },
  actionType: {
    type: String,
    enum: ["generate_action_plan", "execute_action_plan", "notify_user", "request_approval"],
    required: true
  },
  params: { type: Schema.Types.Mixed, required: true, default: {} }
}, { _id: false });

const WorkflowSchema = new Schema<IWorkflow>(
  {
    hiveId: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    trigger: {
      type: {
        type: String,
        enum: ["manual", "mission_completion", "risk_resolved", "recommendation_accepted", "health_score_threshold", "schedule"],
        required: true
      },
      params: {
        type: Schema.Types.Mixed,
        required: true,
        default: {}
      }
    },
    steps: {
      type: [WorkflowStepSchema],
      required: true,
      default: []
    },
    status: {
      type: String,
      enum: ["active", "paused", "inactive"],
      required: true,
      default: "active"
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    isTemplate: {
      type: Boolean,
      required: true,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        ret.hiveId = ret.hiveId.toString();
        if (ret.createdBy) ret.createdBy = ret.createdBy.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

WorkflowSchema.index({ hiveId: 1, "trigger.type": 1, status: 1 });

const Workflow =
  (mongoose.models["Workflow"] as mongoose.Model<IWorkflow>) ||
  mongoose.model<IWorkflow>("Workflow", WorkflowSchema);

export default Workflow;
