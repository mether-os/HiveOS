export type NodeCategory =
  | "Audience"
  | "Problem"
  | "Feature"
  | "Goal"
  | "Tech Stack"
  | "Architecture"
  | "Risk"
  | "Document"
  | "Task";

export type CanvasMode = "Brainstorm" | "Planning" | "Execution";

export interface CanvasNodeData {
  title: string;
  description?: string;
  category: NodeCategory;
  tags: string[];
  createdBy?: string;
  // Mode-specific metadata fields
  priority?: "Low" | "Medium" | "High";
  dueDate?: string;
  status?: "Todo" | "In Progress" | "Blocked" | "Done";
  progress?: number; // 0 to 100
  // Lock state details
  lockedBy?: {
    id: string;
    name: string;
  };
}
