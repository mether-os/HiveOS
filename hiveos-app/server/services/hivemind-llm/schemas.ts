import { z } from "zod";

export const RelatedEntitySchema = z.object({
  entityId: z.string(),
  entityType: z.preprocess((val) => {
    if (typeof val === "string") {
      const lower = val.toLowerCase().trim();
      if (lower === "document" || lower === "activity" || lower === "mutation") {
        return lower;
      }
      // Any other string (e.g. risk, feature, task, node) defaults to "node"
      return "node";
    }
    return "node";
  }, z.enum(["node", "document", "activity", "mutation"])),
  title: z.string()
});

const StringArrayPreprocess = z.preprocess((val) => {
  if (val === undefined || val === null) return [];
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return [];
    return [trimmed];
  }
  if (Array.isArray(val)) {
    return val.map((v) => String(v).trim()).filter(Boolean);
  }
  return [];
}, z.array(z.string()));

export const RiskSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  reason: z.string(),
  relatedEntities: z.array(RelatedEntitySchema),
  suggestedActions: StringArrayPreprocess,
  sourceNodes: StringArrayPreprocess,
  sourceDocuments: StringArrayPreprocess,
  sourceActivities: StringArrayPreprocess
});

export const GapSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["feature_no_prd", "prd_no_task", "arch_no_tech", "github_no_feature"]),
  description: z.string(),
  relatedEntities: z.array(RelatedEntitySchema),
  sourceNodes: StringArrayPreprocess,
  sourceDocuments: StringArrayPreprocess,
  sourceActivities: StringArrayPreprocess
});

export const RecommendationSchema = z.object({
  type: z.enum(["document", "relationship", "task", "architecture", "owner"]),
  title: z.string(),
  reason: z.string(),
  relatedEntities: z.array(RelatedEntitySchema),
  suggestedActions: StringArrayPreprocess,
  sourceNodes: StringArrayPreprocess,
  sourceDocuments: StringArrayPreprocess,
  sourceActivities: StringArrayPreprocess
});

export const MissionSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.string(),
  relatedEntities: z.array(RelatedEntitySchema)
});

export const SummarySchema = z.object({
  executiveSummary: z.string(),
  technicalSummary: z.string(),
  sprintSummary: z.string(),
  recentChanges: StringArrayPreprocess,
  keyRisks: StringArrayPreprocess,
  keyOpportunities: StringArrayPreprocess
});

export const EnhancedAnalysisSchema = z.object({
  healthScore: z.number().min(0).max(100),
  risks: z.array(RiskSchema),
  gaps: z.array(GapSchema),
  recommendations: z.array(RecommendationSchema),
  missions: z.array(MissionSchema),
  summary: SummarySchema
});

export type EnhancedAnalysis = z.infer<typeof EnhancedAnalysisSchema>;
