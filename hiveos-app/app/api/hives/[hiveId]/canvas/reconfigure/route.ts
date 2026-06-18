import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { headers } from "next/headers";
import mongoose from "mongoose";
import Hive from "@/server/models/Hive";
import CanvasNode from "@/server/models/CanvasNode";
import CanvasEdge from "@/server/models/CanvasEdge";
import Document from "@/server/models/Document";
import Activity from "@/server/models/Activity";
import { LLMGateway } from "@/server/services/hivemind-llm/gateway";
import redis from "@/lib/redis";

type RouteContext = { params: Promise<{ hiveId: string }> };

function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\n/, "") // strip opening ```json
      .replace(/\n```$/, "")         // strip closing ```
      .trim();
  }
  return JSON.parse(cleaned);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { hiveId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Verify workspace ownership
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized" }, { status: 404 });
    }

    const body = await request.json();
    const { mutationType, entityId, entityType, details: rawDetails = {} } = body;
const details = sanitizeDetails(rawDetails);


    // Fetch current graph state
    const nodes = await CanvasNode.find({ hiveId: new mongoose.Types.ObjectId(hiveId) }).lean();
    const edges = await CanvasEdge.find({ hiveId: new mongoose.Types.ObjectId(hiveId) }).lean();
    // SEC-6: Sanitize client-supplied details before embedding in LLM prompt
function sanitizeDetails(raw: any): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const ALLOWED_KEYS = ["title", "description", "category", "source", "target", "relationType"];
  const MAX_VALUE_LENGTH = 200;
  const sanitized: Record<string, string> = {};
  for (const key of ALLOWED_KEYS) {
    if (raw[key] !== undefined) {
      sanitized[key] = String(raw[key]).slice(0, MAX_VALUE_LENGTH).replace(/[`${}]/g, "");
    }
  }
  return sanitized;
}

    const systemPrompt = `You are Jarvis/HiveMind, the central collaborative project intelligence. The user has manually updated their project graph by:
- Mutation Type: ${mutationType}
- Target Entity ID: ${entityId}
- Target Entity Type: ${entityType}
- Details: ${JSON.stringify(details)}

Here is the current state of their workspace:
- Nodes: ${JSON.stringify(nodes.map(n => ({ id: n.id, title: n.title, category: n.category, description: n.description })))}
- Edges: ${JSON.stringify(edges.map(e => ({ source: e.source, target: e.target, relationType: e.relationType })))}

Analyze this manual change. To keep the project brain consistent and organized, you should auto-complete/reconfigure the workspace.
Specifically:
- If a manual Feature node was created, you should:
  1. Auto-create 1-2 Task nodes (e.g., "Implement [Feature Title]", "Design [Feature Title]") with Todo status and High/Medium priority.
  2. Auto-connect these Task nodes to the Feature node with an 'owns' or 'depends_on' relationType.
  3. Auto-create a specification Document for the feature (prd or trd) containing a complete markdown spec.
- If a manual Task node was created:
  1. Check if there are related Feature or Tech Stack nodes it should connect to, and auto-create those edges.
- If a connection edge was created:
  1. Re-evaluate if any specification documents need updates to mention the link.

You must respond with a strictly valid JSON object matching this schema:
{
  "nodesToAdd": [
    {
      "id": "node-unique-slug",
      "category": "Feature" | "Task" | "Tech Stack" | "Audience" | "Risk",
      "title": "Short title (max 25 chars)",
      "description": "Brief description of the node",
      "data": {
        "status": "Todo",
        "priority": "Low" | "Medium" | "High"
      }
    }
  ],
  "edgesToAdd": [
    {
      "source": "source-node-slug",
      "target": "target-node-slug",
      "relationType": "depends_on" | "owns" | "uses" | "relates_to"
    }
  ],
  "documentsToAdd": [
    {
      "title": "Specification Title",
      "type": "prd" | "trd",
      "content": "Full markdown text of the specification",
      "linkedNodeId": "associated-feature-node-id"
    }
  ],
  "explanation": "A short sentence explaining what HiveMind auto-completed (e.g. 'HiveMind auto-created implementation tasks and a PRD for the Google Login feature.')"
}

Do not create duplicate nodes that already exist in the workspace.
If no changes are necessary, return empty arrays.
Do not return any surrounding conversation or markdown outside of the JSON.`;

    const userPrompt = `Reconfigure workspace based on manual graph update: ${mutationType}. ASSISTANT:`;
    const gatewayRes = await LLMGateway.getCompletion(systemPrompt, userPrompt);

    if (gatewayRes.error) {
      return NextResponse.json({ error: gatewayRes.error }, { status: 500 });
    }

    try {
      const parsed = cleanAndParseJson(gatewayRes.content);
      const { nodesToAdd = [], edgesToAdd = [], documentsToAdd = [], explanation = "" } = parsed;

      const auditTrail: string[] = [];

      // Save new nodes
      for (const node of nodesToAdd) {
        const nodeId = node.id || `node-reconfig-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
        const position = {
          x: 150 + Math.random() * 300,
          y: 150 + Math.random() * 300
        };

        const nodeDoc = await CanvasNode.create({
          id: nodeId,
          hiveId: new mongoose.Types.ObjectId(hiveId),
          type: "customNode",
          category: node.category,
          title: node.title,
          description: node.description || "",
          position,
          createdBy: new mongoose.Types.ObjectId(session.user.id),
          data: node.data || {}
        });

        auditTrail.push(`Created ${node.category} "${node.title}"`);

        // Index search
        await mongoose.connection.db?.collection("knowledgeindices").updateOne(
          { entityId: nodeId },
          {
            $set: {
              hiveId: new mongoose.Types.ObjectId(hiveId),
              entityType: "node",
              title: node.title,
              content: `${node.description || ""} ${node.category || ""}`.trim(),
              tags: [],
              status: node.data?.status || null,
              metadata: {
                category: node.category,
                priority: node.data?.priority || null,
                createdBy: session.user.id
              },
              sourceUpdatedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );

        if (redis) {
          await redis.publish("hiveos:canvas", JSON.stringify({
            workspaceId: hiveId,
            event: "canvas:node-create",
            payload: { workspaceId: hiveId, node: nodeDoc }
          }));
        }
      }

      // Save edges
      for (const edge of edgesToAdd) {
        const edgeId = `edge-reconfig-${edge.source}-${edge.target}-${Date.now().toString(36)}`;
        const edgeDoc = await CanvasEdge.create({
          id: edgeId,
          hiveId: new mongoose.Types.ObjectId(hiveId),
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          relationType: edge.relationType || "relates_to",
          data: {}
        });

        auditTrail.push(`Connected ${edge.source} to ${edge.target}`);

        if (redis) {
          await redis.publish("hiveos:canvas", JSON.stringify({
            workspaceId: hiveId,
            event: "canvas:edge-create",
            payload: { workspaceId: hiveId, edge: edgeDoc }
          }));
        }
      }

      // Save documents
      for (const doc of documentsToAdd) {
        const docObj = await Document.create({
          hiveId: new mongoose.Types.ObjectId(hiveId),
          nodeId: doc.linkedNodeId,
          title: doc.title,
          type: doc.type || "prd",
          content: doc.content,
          tags: ["spec", doc.type || "prd"],
          status: "draft",
          createdBy: new mongoose.Types.ObjectId(session.user.id),
          updatedBy: new mongoose.Types.ObjectId(session.user.id)
        });

        auditTrail.push(`Drafted spec "${doc.title}"`);

        await mongoose.connection.db?.collection("knowledgeindices").updateOne(
          { entityId: docObj._id.toString() },
          {
            $set: {
              hiveId: new mongoose.Types.ObjectId(hiveId),
              entityType: "document",
              title: docObj.title,
              content: docObj.content,
              tags: docObj.tags,
              status: docObj.status,
              metadata: {
                type: docObj.type,
                createdBy: session.user.id
              },
              sourceUpdatedAt: docObj.updatedAt,
              createdAt: docObj.createdAt,
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
      }

      if (redis && auditTrail.length > 0) {
        await redis.del(`hive:${hiveId}:graph`);
      }

      // Activity logging
      if (auditTrail.length > 0) {
        const descriptionText = explanation || `HiveMind reconfigured workspace in response to manual change: ${auditTrail.join("; ")}.`;
        const activity = await Activity.create({
          hiveId: new mongoose.Types.ObjectId(hiveId),
          type: "system",
          title: "Workspace Reconfigured",
          description: descriptionText,
          actorName: "HiveMind",
          timestamp: new Date()
        });

        if (redis) {
          await redis.publish("hiveos:activity", JSON.stringify({
            hiveId,
            activity: {
              type: "system",
              title: "Workspace Reconfigured",
              description: descriptionText,
              actorName: "HiveMind",
              timestamp: activity.timestamp.toISOString()
            }
          }));
        }
      }

      return NextResponse.json({ success: true, explanation, audit: auditTrail });

    } catch (err: any) {
      console.error("[Reconfigure JSON Parse Error]:", err);
      return NextResponse.json({ error: "Malformed JSON response from LLM reconfigurer." }, { status: 500 });
    }

  } catch (err: any) {
    console.error("[POST /api/hives/[hiveId]/canvas/reconfigure]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
