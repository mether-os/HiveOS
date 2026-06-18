import connectDB from "@/lib/db";
import CanvasNode, { ICanvasNode } from "@/server/models/CanvasNode";
import CanvasEdge, { ICanvasEdge } from "@/server/models/CanvasEdge";
import GraphMutationEvent, { IGraphMutationEvent } from "@/server/models/GraphMutationEvent";
import { redis } from "@/lib/redis";
import mongoose from "mongoose";

export interface AdjacencyEdge {
  targetId: string;
  relationType: string;
  edgeId: string;
}

export interface RevAdjacencyEdge {
  sourceId: string;
  relationType: string;
  edgeId: string;
}

export interface GraphSnapshot {
  nodes: ICanvasNode[];
  edges: ICanvasEdge[];
  adjacencyMap: Record<string, AdjacencyEdge[]>;
  revAdjacencyMap: Record<string, RevAdjacencyEdge[]>;
}

/**
 * Builds the graph snapshot from MongoDB by fetching all nodes and edges
 * and precomputing adjacency maps.
 */
export async function buildGraph(hiveId: string): Promise<GraphSnapshot> {
  await connectDB();
  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);

  // Fetch all nodes and edges for this workspace
  const [nodes, edges] = await Promise.all([
    CanvasNode.find({ hiveId: hiveObjectId }).lean<ICanvasNode[]>().exec(),
    CanvasEdge.find({ hiveId: hiveObjectId }).lean<ICanvasEdge[]>().exec(),
  ]);

  const adjacencyMap: Record<string, AdjacencyEdge[]> = {};
  const revAdjacencyMap: Record<string, RevAdjacencyEdge[]> = {};

  // Initialize maps for all nodes
  for (const node of nodes) {
    adjacencyMap[node.id] = [];
    revAdjacencyMap[node.id] = [];
  }

  // Populate maps based on edges
  for (const edge of edges) {
    const { source, target, relationType = "relates_to", id: edgeId } = edge;

    // Check if source and target nodes exist in the dataset
    if (!adjacencyMap[source]) adjacencyMap[source] = [];
    if (!revAdjacencyMap[target]) revAdjacencyMap[target] = [];

    adjacencyMap[source].push({
      targetId: target,
      relationType,
      edgeId,
    });

    revAdjacencyMap[target].push({
      sourceId: source,
      relationType,
      edgeId,
    });
  }

  // Serialize Mongoose ObjectIds to string for clean caching
  const serializedNodes = nodes.map(n => ({
    ...n,
    _id: n._id.toString(),
    hiveId: n.hiveId.toString(),
    createdBy: n.createdBy.toString(),
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  })) as unknown as ICanvasNode[];

  const serializedEdges = edges.map(e => ({
    ...e,
    _id: e._id.toString(),
    hiveId: e.hiveId.toString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  })) as unknown as ICanvasEdge[];

  return {
    nodes: serializedNodes,
    edges: serializedEdges,
    adjacencyMap,
    revAdjacencyMap,
  };
}

/**
 * Retrieves the graph snapshot for a hive workspace, utilizing Redis cache.
 * Falls back to MongoDB if Redis is down or cache is missing.
 */
export async function getGraphSnapshot(hiveId: string): Promise<GraphSnapshot> {
  const cacheKey = `hive:${hiveId}:graph`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as GraphSnapshot;
      }
    } catch (err: any) {
      console.warn(`[Graph Engine Cache] Error reading cache for ${hiveId}:`, err.message);
    }
  }

  // Cache miss or Redis unavailable: build from DB
  const snapshot = await buildGraph(hiveId);

  if (redis) {
    try {
      // Cache indefinitely (since invalidations occur on mutations), fallback 24h TTL
      await redis.set(cacheKey, JSON.stringify(snapshot), "EX", 86400);
    } catch (err: any) {
      console.warn(`[Graph Engine Cache] Error writing cache for ${hiveId}:`, err.message);
    }
  }

  return snapshot;
}

/**
 * Invalidates the Redis cache key for a hive graph.
 */
export async function invalidateGraphCache(hiveId: string): Promise<void> {
  if (!redis) return;
  const cacheKey = `hive:${hiveId}:graph`;
  try {
    await redis.del(cacheKey);
    console.log(`[Graph Engine Cache] Invalidated cache key: ${cacheKey}`);
  } catch (err: any) {
    console.warn(`[Graph Engine Cache] Error invalidating cache key ${cacheKey}:`, err.message);
  }
}

/**
 * Finds all immediate neighbors (incoming and outgoing) of a selected node.
 */
export async function getConnectedNodes(hiveId: string, nodeId: string) {
  const { adjacencyMap, revAdjacencyMap, nodes } = await getGraphSnapshot(hiveId);
  const nodeLookup = new Map(nodes.map(n => [n.id, n]));

  const outgoing = adjacencyMap[nodeId] || [];
  const incoming = revAdjacencyMap[nodeId] || [];

  return {
    node: nodeLookup.get(nodeId) || null,
    outgoing: outgoing.map(edge => ({
      node: nodeLookup.get(edge.targetId) || null,
      relationType: edge.relationType,
      edgeId: edge.edgeId,
    })),
    incoming: incoming.map(edge => ({
      node: nodeLookup.get(edge.sourceId) || null,
      relationType: edge.relationType,
      edgeId: edge.edgeId,
    })),
  };
}

/**
 * Traces recursive prerequisites / requirements for a node.
 * Resolves outgoing "depends_on" relations and incoming "blocks" relations.
 */
export async function getDependencyChain(hiveId: string, nodeId: string) {
  const { adjacencyMap, revAdjacencyMap, nodes } = await getGraphSnapshot(hiveId);
  const nodeLookup = new Map(nodes.map(n => [n.id, n]));

  const visited = new Set<string>();
  const chain: any[] = [];

  function traverse(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const currentNode = nodeLookup.get(currentId);
    if (!currentNode) return;

    // Outgoing depends_on edges (this node depends on B)
    const outgoingDeps = (adjacencyMap[currentId] || []).filter(e => e.relationType === "depends_on");
    // Incoming blocks edges (B blocks this node, meaning this node depends on B)
    const incomingBlocks = (revAdjacencyMap[currentId] || []).filter(e => e.relationType === "blocks");

    const prerequisites: string[] = [
      ...outgoingDeps.map(e => e.targetId),
      ...incomingBlocks.map(e => e.sourceId)
    ];

    for (const prId of prerequisites) {
      if (!visited.has(prId)) {
        traverse(prId);
      }
    }

    if (currentId !== nodeId) {
      chain.push(currentNode);
    }
  }

  traverse(nodeId);
  return chain;
}

/**
 * Traces all downstream nodes that would be impacted if a selected node is modified (Reachability tree).
 */
export async function getDownstreamImpact(hiveId: string, nodeId: string): Promise<ICanvasNode[]> {
  const { adjacencyMap, nodes } = await getGraphSnapshot(hiveId);
  const nodeLookup = new Map(nodes.map(n => [n.id, n]));

  const visited = new Set<string>();
  const impactList: ICanvasNode[] = [];

  function dfs(currentId: string) {
    visited.add(currentId);

    const outgoing = adjacencyMap[currentId] || [];
    for (const edge of outgoing) {
      if (!visited.has(edge.targetId)) {
        const targetNode = nodeLookup.get(edge.targetId);
        if (targetNode) {
          impactList.push(targetNode);
        }
        dfs(edge.targetId);
      }
    }
  }

  dfs(nodeId);
  return impactList;
}

/**
 * Traces all upstream nodes that represent prerequisites of the selected node (Reverse reachability tree).
 */
export async function getUpstreamRequirements(hiveId: string, nodeId: string): Promise<ICanvasNode[]> {
  const { revAdjacencyMap, nodes } = await getGraphSnapshot(hiveId);
  const nodeLookup = new Map(nodes.map(n => [n.id, n]));

  const visited = new Set<string>();
  const requirementsList: ICanvasNode[] = [];

  function dfs(currentId: string) {
    visited.add(currentId);

    const incoming = revAdjacencyMap[currentId] || [];
    for (const edge of incoming) {
      if (!visited.has(edge.sourceId)) {
        const sourceNode = nodeLookup.get(edge.sourceId);
        if (sourceNode) {
          requirementsList.push(sourceNode);
        }
        dfs(edge.sourceId);
      }
    }
  }

  dfs(nodeId);
  return requirementsList;
}

/**
 * Finds all nodes with zero incoming or outgoing connections.
 */
export async function getOrphanNodes(hiveId: string): Promise<ICanvasNode[]> {
  const { nodes, edges } = await getGraphSnapshot(hiveId);
  const connectedNodeIds = new Set<string>();

  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  return nodes.filter(node => !connectedNodeIds.has(node.id));
}

/**
 * Computes shortest path between two nodes using Breadth-First Search (BFS).
 * Returns array of steps or null if not reachable.
 */
export async function getShortestPath(hiveId: string, startId: string, endId: string) {
  const { adjacencyMap, nodes, edges } = await getGraphSnapshot(hiveId);
  
  const nodeLookup = new Map(nodes.map(n => [n.id, n]));
  const edgeLookup = new Map(edges.map(e => [`${e.source}-${e.target}`, e]));

  if (!nodeLookup.has(startId) || !nodeLookup.has(endId)) return null;
  if (startId === endId) return [];

  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  
  // Track parent pointer to reconstruct path: parent[childNodeId] = { parentNodeId, edge }
  const parent: Record<string, { parentId: string; edge: ICanvasEdge }> = {};

  let found = false;

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endId) {
      found = true;
      break;
    }

    const outgoing = adjacencyMap[current] || [];
    for (const edge of outgoing) {
      if (!visited.has(edge.targetId)) {
        visited.add(edge.targetId);
        
        // Retrieve full edge details
        const edgeObj = edgeLookup.get(`${current}-${edge.targetId}`) || {
          id: edge.edgeId,
          source: current,
          target: edge.targetId,
          relationType: edge.relationType,
        } as unknown as ICanvasEdge;

        parent[edge.targetId] = { parentId: current, edge: edgeObj };
        queue.push(edge.targetId);
      }
    }
  }

  if (!found) return null;

  // Reconstruct path backward
  const path: { node: ICanvasNode; edge: ICanvasEdge }[] = [];
  let curr = endId;
  while (curr !== startId) {
    const step = parent[curr];
    if (!step) break;
    const { parentId, edge } = step;
    const node = nodeLookup.get(curr)!;
    path.unshift({ node, edge });
    curr = parentId;
  }

  return path;
}

/**
 * Groups weakly connected subgraphs (treating edges as undirected).
 * Uses Disjoint Set / Union-Find.
 */
export async function getConnectedComponents(hiveId: string): Promise<ICanvasNode[][]> {
  const { nodes, edges } = await getGraphSnapshot(hiveId);
  const nodeLookup = new Map(nodes.map(n => [n.id, n]));

  // Union-Find structures
  const parent: Record<string, string> = {};
  for (const node of nodes) {
    parent[node.id] = node.id;
  }

  function find(id: string): string {
    const p = parent[id];
    if (!p || p === id) return id;
    parent[id] = find(p); // Path compression
    return parent[id];
  }

  function union(id1: string, id2: string) {
    const root1 = find(id1);
    const root2 = find(id2);
    if (root1 !== root2) {
      parent[root1] = root2;
    }
  }

  // Union all nodes connected by edges
  for (const edge of edges) {
    // Only union if both nodes exist in nodes list
    if (parent[edge.source] && parent[edge.target]) {
      union(edge.source, edge.target);
    }
  }

  // Group node IDs by their roots
  const groups: Record<string, string[]> = {};
  for (const node of nodes) {
    const root = find(node.id);
    if (!groups[root]) groups[root] = [];
    groups[root].push(node.id);
  }

  // Return mapped groups containing full Node documents
  return Object.values(groups).map(nodeIds => 
    nodeIds.map(id => nodeLookup.get(id)!).filter(Boolean)
  );
}

/**
 * Reconstructs the exact state of graph nodes and edges at timestamp T
 * by executing sequential transition replays.
 */
export async function reconstructStateAt(hiveId: string, timestamp: Date) {
  await connectDB();
  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);

  // Fetch all mutation events up to the selected timestamp, sorted ascending
  const events = await GraphMutationEvent.find({
    hiveId: hiveObjectId,
    timestamp: { $lte: timestamp }
  })
    .sort({ timestamp: 1 })
    .lean<IGraphMutationEvent[]>()
    .exec();

  const nodesMap = new Map<string, any>();
  const edgesMap = new Map<string, any>();

  // Replay mutations sequentially
  for (const event of events) {
    const { eventType, entityId, nextState } = event;

    switch (eventType) {
      case "node_created":
        nodesMap.set(entityId, nextState);
        break;
      case "node_updated":
        if (nodesMap.has(entityId)) {
          nodesMap.set(entityId, { ...nodesMap.get(entityId), ...nextState });
        } else {
          nodesMap.set(entityId, nextState); // Fallback if out-of-order
        }
        break;
      case "node_deleted":
        nodesMap.delete(entityId);
        // Cascade delete connected edges from replay state
        for (const [edgeId, edge] of edgesMap.entries()) {
          if (edge.source === entityId || edge.target === entityId) {
            edgesMap.delete(edgeId);
          }
        }
        break;
      case "edge_created":
        edgesMap.set(entityId, nextState);
        break;
      case "edge_deleted":
        edgesMap.delete(entityId);
        break;
      default:
        break;
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
  };
}
