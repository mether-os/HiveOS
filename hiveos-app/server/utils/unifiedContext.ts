import mongoose from "mongoose";
import KnowledgeIndex from "@/server/models/KnowledgeIndex";
import Document from "@/server/models/Document";
import CanvasNode from "@/server/models/CanvasNode";
import CanvasEdge from "@/server/models/CanvasEdge";
import Activity from "@/server/models/Activity";
import GraphMutationEvent from "@/server/models/GraphMutationEvent";
import SearchMetric from "@/server/models/SearchMetric";

export interface ResolvedRelationship {
  entityId: string;
  entityType: "node" | "document" | "activity" | "mutation";
  title: string;
  relationship: string; // "dependency", "reference", "tag_similarity", "text_similarity", "explicit_edge"
  confidence: number; // 0.0 to 1.0
  metadata?: Record<string, any>;
}

export interface EntityContextPayload {
  entityId: string;
  entityType: string;
  title: string;
  status?: string;
  tags: string[];
  content: string;
  relationships: ResolvedRelationship[];
  formattedPromptContext: string;
}

export interface ProjectContextPayload {
  importantNodes: any[];
  activeDocuments: any[];
  recentActivities: any[];
  recentTimeline: any[];
  dependencySummary: string[];
  nodes: any[];
  edges: any[];
}

/**
 * 1. searchKnowledge()
 * Searches the unified KnowledgeIndex collection and ranks matches based on weights.
 */
export async function searchKnowledge(hiveId: string, query: string): Promise<any[]> {
  const startTime = Date.now();
  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);
  const trimmed = query.trim();

  if (!trimmed) return [];

  // Define weights based on requirements:
  // Node Title > Document Title > Tags > Document Content > GitHub Activity > Timeline Events
  const typeWeights: Record<string, number> = {
    node: 10,
    document: 8,
    activity: 1.5,
    mutation: 0.5,
  };

  const regex = new RegExp(trimmed, "i");
  let indexMatches: any[] = [];

  // 1. Try high-performance MongoDB Text Index Search first
  if (trimmed.length >= 3) {
    try {
      indexMatches = await KnowledgeIndex.find(
        { hiveId: hiveObjectId, $text: { $search: trimmed } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .lean()
        .exec();
    } catch (err: any) {
      console.warn("[Search] Text index search failed, falling back to regex:", err.message);
    }
  }

  // 2. Fallback to optimized regex search on indexed title/tags fields if text search yield 0 hits
  if (indexMatches.length === 0) {
    indexMatches = await KnowledgeIndex.find({
      hiveId: hiveObjectId,
      $or: [
        { title: { $regex: regex } },
        { tags: { $in: [regex] } }
      ]
    })
      .lean()
      .exec();

    // 3. Scan content field only as a last resort with a strict limit (prevents connection exhaustion)
    if (indexMatches.length === 0) {
      indexMatches = await KnowledgeIndex.find({
        hiveId: hiveObjectId,
        content: { $regex: regex }
      })
        .limit(50)
        .lean()
        .exec();
    }
  }

  const scoredResults = indexMatches.map((indexDoc) => {
    const baseWeight = typeWeights[indexDoc.entityType] ?? 1;
    let matchScore = 1;

    // Custom matching score weights: Title (10) > Tags (5) > Content (1)
    if (regex.test(indexDoc.title)) {
      matchScore = 10;
    } else if (indexDoc.tags?.some((tag: string) => regex.test(tag))) {
      matchScore = 5;
    }

    const finalScore = matchScore * baseWeight;

    return {
      ...indexDoc,
      id: indexDoc.entityId,
      score: finalScore,
    };
  }).sort((a, b) => b.score - a.score);

  // Log metric analytics in background
  const latency = Date.now() - startTime;
  SearchMetric.create({
    hiveId: hiveObjectId,
    query: trimmed,
    latencyMs: latency,
    resultsCount: scoredResults.length,
    timestamp: new Date()
  }).catch((err) => console.error("[Metrics] Failed logging search metrics:", err));

  return scoredResults;
}

/**
 * 2. findRelatedEntities()
 * Finds and aggregates semantic relationships with confidence scoring.
 */
export async function findRelatedEntities(
  hiveId: string,
  entityType: "node" | "document" | "activity" | "mutation",
  entityId: string
): Promise<ResolvedRelationship[]> {
  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);
  const relationships: ResolvedRelationship[] = [];

  // 1. Load the active entity context
  let targetTitle = "";
  let targetTags: string[] = [];
  let targetNodeId = ""; // React Flow ID if it represents a node

  if (entityType === "node") {
    const node = await CanvasNode.findOne({ hiveId: hiveObjectId, id: entityId }).exec();
    if (node) {
      targetTitle = node.title;
      targetTags = node.tags || [];
      targetNodeId = node.id;
    }
  } else if (entityType === "document") {
    if (mongoose.Types.ObjectId.isValid(entityId)) {
      const doc = await Document.findOne({ hiveId: hiveObjectId, _id: new mongoose.Types.ObjectId(entityId) }).exec();
      if (doc) {
        targetTitle = doc.title;
        targetTags = doc.tags || [];
        targetNodeId = doc.nodeId || "";
      }
    }
  }

  // A. PRIORITY 1: Explicit Graph Relationships (from CanvasEdge)
  if (targetNodeId) {
    const edges = await CanvasEdge.find({
      hiveId: hiveObjectId,
      $or: [{ source: targetNodeId }, { target: targetNodeId }]
    }).exec();

    if (edges.length > 0) {
      const otherNodeIds = edges.map(edge => edge.source === targetNodeId ? edge.target : edge.source);
      // Bulk query all connected nodes in one trip
      const nodes = await CanvasNode.find({ hiveId: hiveObjectId, id: { $in: otherNodeIds } }).exec();
      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      for (const edge of edges) {
        const isOutgoing = edge.source === targetNodeId;
        const otherNodeId = isOutgoing ? edge.target : edge.source;
        const node = nodeMap.get(otherNodeId);

        if (node) {
          relationships.push({
            entityId: node.id,
            entityType: "node",
            title: node.title,
            relationship: isOutgoing ? `blocks (${edge.relationType})` : `depends_on (${edge.relationType})`,
            confidence: 1.0,
            metadata: { edgeId: edge.id, relationType: edge.relationType }
          });
        }
      }
    }
  }

  // B. PRIORITY 2: Document References (scans markdown links)
  // Check documents linking to target
  if (targetNodeId) {
    // Check if any Document references this node [@Title](node:nodeId)
    const referencingDocs = await Document.find({
      hiveId: hiveObjectId,
      content: { $regex: new RegExp(`node:${targetNodeId}`, "i") }
    }).exec();

    for (const doc of referencingDocs) {
      relationships.push({
        entityId: doc._id.toString(),
        entityType: "document",
        title: doc.title,
        relationship: "document_reference",
        confidence: 0.8,
        metadata: { type: doc.type }
      });
    }
  }

  // Check if current Document has markdown links to other nodes or documents
  if (entityType === "document" && mongoose.Types.ObjectId.isValid(entityId)) {
    const doc = await Document.findOne({ hiveId: hiveObjectId, _id: new mongoose.Types.ObjectId(entityId) }).exec();
    if (doc && doc.content) {
      // Find node links: [@Name](node:nodeId)
      const nodeMatches = [...doc.content.matchAll(/\[@([^\]]+)\]\(node:([a-zA-Z0-9_-]+)\)/g)];
      const nodeIds = nodeMatches.map(m => m[2]).filter((id): id is string => !!id);

      if (nodeIds.length > 0) {
        // Bulk fetch all inline referenced nodes in one trip
        const linkedNodes = await CanvasNode.find({ hiveId: hiveObjectId, id: { $in: nodeIds } } as any).exec();
        const nodeMap = new Map(linkedNodes.map(n => [n.id, n]));

        for (const m of nodeMatches) {
          const nodeId = m[2];
          if (nodeId) {
            const linkedNode = nodeMap.get(nodeId);
            if (linkedNode) {
              relationships.push({
                entityId: linkedNode.id,
                entityType: "node",
                title: linkedNode.title,
                relationship: "inline_node_reference",
                confidence: 0.8
              });
            }
          }
        }
      }

      // Find doc links: [#Name](doc:docId)
      const docMatches = [...doc.content.matchAll(/\[#([^\]]+)\]\(doc:([a-zA-Z0-9_-]+)\)/g)];
      const docIdStrs = docMatches.map(m => m[2]).filter((id): id is string => !!id && mongoose.Types.ObjectId.isValid(id));

      if (docIdStrs.length > 0) {
        const docObjectIds = docIdStrs.map(id => new mongoose.Types.ObjectId(id));
        // Bulk fetch all inline referenced documents in one trip
        const linkedDocs = await Document.find({ hiveId: hiveObjectId, _id: { $in: docObjectIds } } as any).exec();
        const docMap = new Map(linkedDocs.map(d => [d._id.toString(), d]));

        for (const m of docMatches) {
          const linkedDocIdStr = m[2];
          if (linkedDocIdStr) {
            const linkedDoc = docMap.get(linkedDocIdStr);
            if (linkedDoc) {
              relationships.push({
                entityId: linkedDoc._id.toString(),
                entityType: "document",
                title: linkedDoc.title,
                relationship: "inline_document_reference",
                confidence: 0.8
              });
            }
          }
        }
      }
    }
  }

  // C. PRIORITY 3: GitHub references
  // Check if any GitHub Activity is mapped to this node or references title
  if (targetNodeId || targetTitle) {
    const activities = await Activity.find({
      hiveId: hiveObjectId,
      $or: [
        { "graphLinks.nodeId": targetNodeId },
        { description: { $regex: new RegExp(targetTitle, "i") } }
      ]
    }).limit(10).exec();

    for (const act of activities) {
      // Check confidence score
      const matchingLink = act.graphLinks?.find((link) => link.nodeId === targetNodeId);
      const confidence = matchingLink ? matchingLink.confidence : 0.6; // fallback heuristic

      relationships.push({
        entityId: act._id.toString(),
        entityType: "activity",
        title: act.title,
        relationship: "github_activity_link",
        confidence,
        metadata: { type: act.type, actorName: act.actorName }
      });
    }
  }

  // D. PRIORITY 4: Tag Similarity
  if (targetTags.length > 0) {
    // Overlapping tags on nodes
    const tagMatchNodes = await CanvasNode.find({
      hiveId: hiveObjectId,
      id: { $ne: targetNodeId },
      tags: { $in: targetTags }
    }).limit(5).exec();

    for (const node of tagMatchNodes) {
      const intersect = node.tags.filter((t) => targetTags.includes(t));
      const confidence = Math.min(0.5, 0.3 + 0.05 * intersect.length);
      
      // Avoid duplicate relationships
      if (!relationships.some((r) => r.entityId === node.id)) {
        relationships.push({
          entityId: node.id,
          entityType: "node",
          title: node.title,
          relationship: `tag_similarity (${intersect.join(", ")})`,
          confidence
        });
      }
    }

    // Overlapping tags on documents
    const tagMatchDocs = await Document.find({
      hiveId: hiveObjectId,
      _id: { $ne: entityType === "document" && mongoose.Types.ObjectId.isValid(entityId) ? new mongoose.Types.ObjectId(entityId) : null },
      tags: { $in: targetTags }
    }).limit(5).exec();

    for (const doc of tagMatchDocs) {
      const intersect = doc.tags.filter((t) => targetTags.includes(t));
      const confidence = Math.min(0.5, 0.3 + 0.05 * intersect.length);
      const docIdStr = doc._id.toString();

      if (!relationships.some((r) => r.entityId === docIdStr)) {
        relationships.push({
          entityId: docIdStr,
          entityType: "document",
          title: doc.title,
          relationship: `tag_similarity (${intersect.join(", ")})`,
          confidence
        });
      }
    }
  }

  // E. PRIORITY 5: Text Similarity
  if (targetTitle) {
    const importantWords = targetTitle
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
      .filter((w) => w.length > 4); // ignore short stopwords

    if (importantWords.length > 0) {
      const regexQueries = importantWords.map((word) => new RegExp(word, "i"));
      
      // Text similarity in nodes
      const textMatchNodes = await CanvasNode.find({
        hiveId: hiveObjectId,
        id: { $ne: targetNodeId },
        title: { $in: regexQueries }
      }).limit(3).exec();

      for (const node of textMatchNodes) {
        if (!relationships.some((r) => r.entityId === node.id)) {
          relationships.push({
            entityId: node.id,
            entityType: "node",
            title: node.title,
            relationship: "text_similarity",
            confidence: 0.2
          });
        }
      }
    }
  }

  // Deduplicate and sort relationships by confidence descending
  const uniqueRels: ResolvedRelationship[] = [];
  const seenKeys = new Set<string>();

  for (const rel of relationships) {
    const key = `${rel.entityType}:${rel.entityId}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueRels.push(rel);
    } else {
      // Keep higher confidence link
      const existing = uniqueRels.find((r) => r.entityId === rel.entityId && r.entityType === rel.entityType);
      if (existing && existing.confidence < rel.confidence) {
        existing.confidence = rel.confidence;
        existing.relationship = rel.relationship;
      }
    }
  }

  return uniqueRels.sort((a, b) => b.confidence - a.confidence);
}

/**
 * 3. getEntityContext()
 * Assembles text representations of an entity and its resolved surroundings.
 */
export async function getEntityContext(
  hiveId: string,
  entityType: "node" | "document" | "activity" | "mutation",
  entityId: string
): Promise<EntityContextPayload | null> {
  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);
  let title = "";
  let content = "";
  let tags: string[] = [];
  let status: string | undefined;

  if (entityType === "node") {
    const node = await CanvasNode.findOne({ hiveId: hiveObjectId, id: entityId }).exec();
    if (!node) return null;
    title = node.title;
    content = node.description || "";
    tags = node.tags || [];
    status = node.data?.status || "Todo";
  } else if (entityType === "document") {
    if (!mongoose.Types.ObjectId.isValid(entityId)) return null;
    const doc = await Document.findOne({ hiveId: hiveObjectId, _id: new mongoose.Types.ObjectId(entityId) }).exec();
    if (!doc) return null;
    title = doc.title;
    content = doc.content || "";
    tags = doc.tags || [];
    status = doc.status;
  } else if (entityType === "activity") {
    if (!mongoose.Types.ObjectId.isValid(entityId)) return null;
    const act = await Activity.findOne({ hiveId: hiveObjectId, _id: new mongoose.Types.ObjectId(entityId) }).exec();
    if (!act) return null;
    title = act.title;
    content = act.description || "";
    tags = [];
  } else if (entityType === "mutation") {
    if (!mongoose.Types.ObjectId.isValid(entityId)) return null;
    const mut = await GraphMutationEvent.findOne({ hiveId: hiveObjectId, _id: new mongoose.Types.ObjectId(entityId) }).exec();
    if (!mut) return null;
    title = `Graph Mutation: ${mut.eventType}`;
    content = `Event mutates entity ID ${mut.entityId} (${mut.entityType}) by actor ${mut.actorName}`;
    tags = [];
  }

  // Load resolved relationships
  const relationships = await findRelatedEntities(hiveId, entityType, entityId);

  // Assemble formatted prompt context
  let formattedPromptContext = `=== ENTITY CONTEXT PROFILE ===\n`;
  formattedPromptContext += `Entity ID: ${entityId}\n`;
  formattedPromptContext += `Type: ${entityType.toUpperCase()}\n`;
  formattedPromptContext += `Title: ${title}\n`;
  if (status) formattedPromptContext += `Status: ${status.toUpperCase()}\n`;
  if (tags.length > 0) formattedPromptContext += `Tags: ${tags.join(", ")}\n`;
  formattedPromptContext += `Description / Content:\n${content}\n\n`;

  formattedPromptContext += `=== RESOLVED RELATIONSHIPS ===\n`;
  if (relationships.length === 0) {
    formattedPromptContext += `No linked or related entities resolved.\n`;
  } else {
    relationships.forEach((rel) => {
      formattedPromptContext += `- [${rel.entityType.toUpperCase()}] "${rel.title}" (ID: ${rel.entityId}) | Link Type: ${rel.relationship} | Confidence: ${rel.confidence}\n`;
    });
  }

  return {
    entityId,
    entityType,
    title,
    status,
    tags,
    content,
    relationships,
    formattedPromptContext
  };
}

/**
 * 4. getProjectContext()
 * Primary context provider summarizing the entire project workspace for AI reasoners.
 */
export async function getProjectContext(hiveId: string): Promise<ProjectContextPayload> {
  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);

  // A. Important Nodes (Feature/Goal nodes that are bottlenecks/highly linked)
  const allNodes = await CanvasNode.find({ hiveId: hiveObjectId }).exec();
  const allEdges = await CanvasEdge.find({ hiveId: hiveObjectId }).exec();

  // Calculate degree centrality (counts incoming/outgoing edges)
  const nodeDegrees: Record<string, number> = {};
  allEdges.forEach((edge) => {
    nodeDegrees[edge.source] = (nodeDegrees[edge.source] ?? 0) + 1;
    nodeDegrees[edge.target] = (nodeDegrees[edge.target] ?? 0) + 1;
  });

  const sortedNodes = [...allNodes]
    .map((node) => ({
      id: node.id,
      title: node.title,
      category: node.category,
      status: node.data?.status || "Todo",
      priority: node.data?.priority || "Low",
      degree: nodeDegrees[node.id] ?? 0
    }))
    .sort((a, b) => b.degree - a.degree);

  // Important Nodes (top 5 degree centrality)
  const importantNodes = sortedNodes.slice(0, 5);

  // B. Active Documents (approved/review or recently modified)
  const activeDocs = await Document.find({ hiveId: hiveObjectId })
    .sort({ updatedAt: -1 })
    .limit(5)
    .exec();

  // C. Recent GitHub Activity (last 5 logs)
  const recentActivities = await Activity.find({ hiveId: hiveObjectId })
    .sort({ timestamp: -1 })
    .limit(5)
    .exec();

  // D. Recent Timeline Events (last 5 mutations)
  const recentTimeline = await GraphMutationEvent.find({ hiveId: hiveObjectId })
    .sort({ timestamp: -1 })
    .limit(5)
    .exec();

  // E. Dependency Graph Summary
  const dependencySummary: string[] = [];
  allEdges.forEach((edge) => {
    const srcNode = allNodes.find((n) => n.id === edge.source);
    const tgtNode = allNodes.find((n) => n.id === edge.target);
    if (srcNode && tgtNode) {
      dependencySummary.push(`[${srcNode.category}] "${srcNode.title}" ${edge.relationType || "relates_to"} [${tgtNode.category}] "${tgtNode.title}"`);
    }
  });

  return {
    importantNodes,
    activeDocuments: activeDocs,
    recentActivities,
    recentTimeline,
    dependencySummary,
    nodes: allNodes,
    edges: allEdges
  };
}
