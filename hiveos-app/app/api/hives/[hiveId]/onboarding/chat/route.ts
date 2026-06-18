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

function sanitizeCategory(cat: string): any {
  if (!cat) return "Feature";
  const normalized = cat.trim().toLowerCase();
  
  if (normalized === "audiences" || normalized === "audience") return "Audience";
  if (normalized === "problems" || normalized === "problem") return "Problem";
  if (normalized === "features" || normalized === "feature") return "Feature";
  if (normalized === "goals" || normalized === "goal") return "Goal";
  if (normalized === "tech stacks" || normalized === "tech stack" || normalized === "techstack" || normalized === "tech_stack" || normalized === "technologies" || normalized === "technology") return "Tech Stack";
  if (normalized === "architectures" || normalized === "architecture") return "Architecture";
  if (normalized === "risks" || normalized === "risk") return "Risk";
  if (normalized === "documents" || normalized === "document" || normalized === "doc" || normalized === "specs" || normalized === "spec") return "Document";
  if (normalized === "tasks" || normalized === "task") return "Task";

  const VALID_CATEGORIES = [
    "Audience",
    "Problem",
    "Feature",
    "Goal",
    "Tech Stack",
    "Architecture",
    "Risk",
    "Document",
    "Task"
  ];
  const found = VALID_CATEGORIES.find(c => c.toLowerCase() === normalized);
  if (found) return found;

  return "Feature";
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

    if (!mongoose.Types.ObjectId.isValid(hiveId)) {
      return NextResponse.json({ error: "Invalid hive ID" }, { status: 400 });
    }

    await connectDB();

    // Verify ownership of the workspace
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized" }, { status: 404 });
    }

    const body = await request.json();
    const { action = "chat", messages = [], chosenCategories, selectedIdea, projectDescription } = body;

    // -------------------------------------------------------------------------
    // ACTION: get_ideas (Path B initial step)
    // -------------------------------------------------------------------------
    if (action === "get_ideas") {
      if (!chosenCategories) {
        return NextResponse.json({ error: "chosenCategories is required for action 'get_ideas'" }, { status: 400 });
      }

      const systemPrompt = `You are HiveMind, the intelligent collaborative project brain. The user wants to build a project but needs ideas. They have chosen these interests:
- Target Audiences: ${(chosenCategories.audiences || []).join(", ") || "startups, developers"}
- Technology Interests: ${(chosenCategories.tech || []).join(", ") || "AI, web apps"}
- Skills: ${(chosenCategories.skills || []).join(", ") || "React, Node.js"}

Generate exactly 3 highly creative, modern, and detailed project ideas that combine these choices.
Each idea must have a title, tagline, description, and list of 4 core features.
You MUST respond with a strictly valid JSON object matching this schema:
{
  "ideas": [
    {
      "title": "Creative project name",
      "tagline": "Short compelling tagline",
      "description": "Short description of what it is",
      "features": ["Feature A", "Feature B", "Feature C", "Feature D"]
    }
  ]
}
Do not return any surrounding conversation or markdown formatting outside of the JSON block.`;

      const userPrompt = "Generate 3 project ideas based on my selections. ASSISTANT:";
      const gatewayRes = await LLMGateway.getCompletion(systemPrompt, userPrompt);

      if (gatewayRes.error) {
        return NextResponse.json({ error: gatewayRes.error }, { status: 500 });
      }

      try {
        const parsed = cleanAndParseJson(gatewayRes.content);
        return NextResponse.json({ ideas: parsed.ideas || [] });
      } catch (err: any) {
        console.error("[Onboarding API] Parse error in get_ideas:", err);
        return NextResponse.json({ error: "Malformed JSON returned from LLM." }, { status: 500 });
      }
    }

    // -------------------------------------------------------------------------
    // ACTION: chat (Conversational discovery step)
    // -------------------------------------------------------------------------
    if (action === "chat") {
      if (messages.length === 0) {
        return NextResponse.json({ error: "messages array is required for action 'chat'" }, { status: 400 });
      }

      // Fetch existing nodes to feed as context so the LLM doesn't duplicate them
      const existingNodes = await CanvasNode.find({ hiveId: new mongoose.Types.ObjectId(hiveId) }).lean();

      const systemPrompt = `You are HiveMind, the central intelligence of this project. You are having an onboarding conversation with the user to discover, architect, and shape their project brain.
Your goal is to understand their project, challenge assumptions, identify potential risks, suggest appropriate tech stacks, and gradually construct their project graph.

You must respond with a strictly valid JSON object matching this schema:
{
  "message": "Markdown response text. Express excitement, analyze their inputs, challenge assumptions, list 1-2 potential risks or architecture details, and ask 2-3 specific follow-up questions to help you design the next parts.",
  "thinking": "Your internal cognitive monologue detailing what architecture requirements, risks, or audiences you are analyzing.",
  "nodesToAdd": [
    {
      "id": "node-unique-slug",
      "category": "Audience" | "Problem" | "Feature" | "Goal" | "Tech Stack" | "Architecture" | "Risk",
      "title": "Short title of the node (max 25 chars)",
      "description": "Brief description of the node",
      "position": { "x": number, "y": number }
    }
  ],
  "edgesToAdd": [
    {
      "id": "edge-unique-slug",
      "source": "node-source-slug",
      "target": "node-target-slug",
      "relationType": "depends_on" | "blocks" | "documents" | "owns" | "uses" | "relates_to"
    }
  ],
  "complete": false
}

Layout guidelines for node coordinates (place them cleanly):
- Goals: y around -200 to -100, x centered around 0.
- Audience: y around -100, x left (e.g. -400 to -200).
- Problems: y around 0, x centered around 0.
- Features: y around 150 to 250, x centered around 0.
- Tech Stack / Architecture: y around 350 to 450, x centered around 0.
- Risks: y around 150 to 250, x right (e.g. 300 to 500).

Do not add too many nodes in a single turn (aim for 2-4 nodes). Let the project brain evolve naturally as understanding improves.
Do not recreate existing nodes. Here are the nodes already discovered on the canvas:
${JSON.stringify(existingNodes.map(n => ({ id: n.id, title: n.title, category: n.category })))}

Do not include any text outside the JSON.`;

      let userPrompt = "Conversation history:\n";
      messages.forEach((m: any) => {
        userPrompt += `${m.role.toUpperCase()}: ${m.content}\n`;
      });
      userPrompt += "ASSISTANT (respond only in JSON):";

      const gatewayRes = await LLMGateway.getCompletion(systemPrompt, userPrompt);

      if (gatewayRes.error) {
        return NextResponse.json({ error: gatewayRes.error }, { status: 500 });
      }

      try {
        const parsed = cleanAndParseJson(gatewayRes.content);
        const { message, thinking, nodesToAdd = [], edgesToAdd = [], complete = false } = parsed;

        // Persist newly discovered nodes and edges
        const savedNodes = [];
        const savedEdges = [];

        for (const node of nodesToAdd) {
          const nodeDoc = await CanvasNode.findOneAndUpdate(
            { hiveId: new mongoose.Types.ObjectId(hiveId), id: node.id },
            {
              $set: {
                type: "customNode",
                category: sanitizeCategory(node.category),
                title: node.title || node.label || node.name || "Untitled Node",
                description: node.description || "",
                tags: node.tags || [],
                position: node.position || { x: 0, y: 0 },
                createdBy: new mongoose.Types.ObjectId(session.user.id),
                data: node.data || {}
              }
            },
            { upsert: true, new: true }
          );
          savedNodes.push(nodeDoc);

          // Index in Knowledge Target
          await mongoose.connection.db?.collection("knowledgeindices").updateOne(
            { entityId: node.id },
            {
              $set: {
                hiveId: new mongoose.Types.ObjectId(hiveId),
                entityType: "node",
                 title: node.title || node.label || node.name || "Untitled Node",
                content: `${node.description || ""} ${node.category || ""}`.trim(),
                tags: node.tags || [],
                status: node.data?.status || null,
                metadata: {
                  category: sanitizeCategory(node.category),
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

          // Publish creation over Redis
          if (redis) {
            await redis.publish("hiveos:canvas", JSON.stringify({
              workspaceId: hiveId,
              event: "canvas:node-create",
              payload: { workspaceId: hiveId, node: nodeDoc }
            }));
          }
        }

        for (const edge of edgesToAdd) {
          const edgeDoc = await CanvasEdge.findOneAndUpdate(
            { hiveId: new mongoose.Types.ObjectId(hiveId), id: edge.id },
            {
              $set: {
                source: edge.source,
                target: edge.target,
                type: "smoothstep",
                relationType: edge.relationType || "relates_to",
                data: edge.data || {}
              }
            },
            { upsert: true, new: true }
          );
          savedEdges.push(edgeDoc);

          if (redis) {
            await redis.publish("hiveos:canvas", JSON.stringify({
              workspaceId: hiveId,
              event: "canvas:edge-create",
              payload: { workspaceId: hiveId, edge: edgeDoc }
            }));
          }
        }

        if (redis && (nodesToAdd.length > 0 || edgesToAdd.length > 0)) {
          await redis.del(`hive:${hiveId}:graph`);
        }

        return NextResponse.json({
          message,
          thinking,
          complete
        });

      } catch (err: any) {
        console.error("[Onboarding API] Parse error in chat:", err);
        return NextResponse.json({ error: "Malformed JSON returned from LLM." }, { status: 500 });
      }
    }

    // -------------------------------------------------------------------------
    // ACTION: finalize (Path A or Path B completion - seeds documents and tasks)
    // -------------------------------------------------------------------------
    if (action === "finalize") {
      if (!projectDescription) {
        return NextResponse.json({ error: "projectDescription is required to finalize project brain" }, { status: 400 });
      }

      const systemPrompt = `You are HiveMind, the intelligent collaborative project brain. We are ready to finalize the Unified Project Brain.
Based on the full project description and conversation notes:
"${projectDescription}"

Generate a complete, high-quality structure of project nodes, task cards, and linked document specifications.
You must respond with a strictly valid JSON object matching this schema:
{
  "nodes": [
    {
      "id": "node-unique-slug",
      "category": "Audience" | "Problem" | "Feature" | "Goal" | "Tech Stack" | "Architecture" | "Risk" | "Task",
      "title": "Short title (max 25 chars)",
      "description": "Brief description of the node",
      "position": { "x": number, "y": number },
      "data": { // only if category is 'Task'
        "status": "Todo",
        "priority": "Low" | "Medium" | "High",
        "dueDate": "YYYY-MM-DD",
        "assigneeName": string,
        "assigneeId": string
      }
    }
  ],
  "edges": [
    {
      "id": "edge-unique-slug",
      "source": "node-source-slug",
      "target": "node-target-slug",
      "relationType": "depends_on" | "blocks" | "documents" | "owns" | "uses" | "relates_to"
    }
  ],
  "documents": [
    {
      "title": "Product Requirements Document (PRD)" | "Technical Design Document (TRD)" | "Architecture Blueprint",
      "type": "prd" | "trd" | "architecture",
      "content": "Concise, high-level project spec summary in markdown format (max 200 words). Keep it brief to prevent truncation.",
      "linkedNodeId": "associated-feature-node-id"
    }
  ]
}

=== TASK ASSIGNMENT DIVISION RULE ===
You MUST divide the generated Task nodes among the project team members.
The team consists of:
1. Leader / Owner: "${session.user.name}" (ID: "${session.user.id}")
2. Virtual Specialist: "Sarah (UI/Frontend)" (ID: "virtual-sarah")
3. Virtual Specialist: "John (APIs/Backend)" (ID: "virtual-john")
4. Virtual Specialist: "Alex (DevOps/Cloud)" (ID: "virtual-alex")

Match task complexity and feature category with the respective assignee:
- Sarah gets UI, component, frontend integration, and styling tasks.
- John gets database connection, socket events, REST routes, and API tasks.
- Alex gets deployment pipelines, environment configuration, database seeding, and setup tasks.
- "${session.user.name}" gets coordination, product architecture, testing, and review tasks.

Ensure every generated Task node has "assigneeName" and "assigneeId" filled out correctly in its "data" object matching one of these 4 members.

Layout guidelines for node coordinates (place them cleanly):
- Goals: y around -200 to -100, x centered around 0.
- Audience: y around -100, x left (e.g. -400 to -200).
- Problems: y around 0, x centered around 0.
- Features: y around 150 to 250, x centered.
- Tech Stack / Architecture: y around 350 to 450, x centered.
- Risks: y around 150 to 250, x right (e.g. 300 to 500).
- Tasks: y around 150 to 250, x far right (e.g. 600 to 800).

Make sure all edges connecting Features to Tasks use 'owns' or 'depends_on' relationTypes.
Keep document content text strictly under 250 words each. Do not output more than 2 document items in the array. This keeps the response compact to prevent JSON truncation errors.
Do not include any text outside the JSON.`;

      const userPrompt = "Discovered project context. Generate the final brain. ASSISTANT:";
      const gatewayRes = await LLMGateway.getCompletion(systemPrompt, userPrompt);

      if (gatewayRes.error) {
        return NextResponse.json({ error: gatewayRes.error }, { status: 500 });
      }

      try {
        const parsed = cleanAndParseJson(gatewayRes.content);
        const { nodes = [], edges = [], documents = [] } = parsed;

        // Clear existing canvas nodes, edges, and documents for this workspace
        await CanvasNode.deleteMany({ hiveId: new mongoose.Types.ObjectId(hiveId) });
        await CanvasEdge.deleteMany({ hiveId: new mongoose.Types.ObjectId(hiveId) });
        await Document.deleteMany({ hiveId: new mongoose.Types.ObjectId(hiveId) });
        await mongoose.connection.db?.collection("knowledgeindices").deleteMany({ hiveId: new mongoose.Types.ObjectId(hiveId) });

        // Save new nodes
        const savedNodes = [];
        for (const node of nodes) {
          const nodeDoc = await CanvasNode.create({
            id: node.id,
            hiveId: new mongoose.Types.ObjectId(hiveId),
            type: "customNode",
            category: sanitizeCategory(node.category),
            title: node.title || node.label || node.name || "Untitled Node",
            description: node.description || "",
            tags: node.tags || [],
            position: node.position || { x: 0, y: 0 },
            createdBy: new mongoose.Types.ObjectId(session.user.id),
            data: node.data || {}
          });
          savedNodes.push(nodeDoc);

          // Index in Knowledge target
          await mongoose.connection.db?.collection("knowledgeindices").updateOne(
            { entityId: node.id },
            {
              $set: {
                hiveId: new mongoose.Types.ObjectId(hiveId),
                entityType: "node",
                title: node.title || node.label || node.name || "Untitled Node",
                content: `${node.description || ""} ${node.category || ""}`.trim(),
                tags: node.tags || [],
                status: node.data?.status || null,
                metadata: {
                  category: sanitizeCategory(node.category),
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
        }

        // Save edges
        const savedEdges = [];
        for (const edge of edges) {
          const edgeDoc = await CanvasEdge.create({
            id: edge.id,
            hiveId: new mongoose.Types.ObjectId(hiveId),
            source: edge.source,
            target: edge.target,
            type: "smoothstep",
            relationType: edge.relationType || "relates_to",
            data: edge.data || {}
          });
          savedEdges.push(edgeDoc);
        }

        // Save documents
        for (const doc of documents) {
          const docObj = await Document.create({
            hiveId: new mongoose.Types.ObjectId(hiveId),
            nodeId: doc.linkedNodeId,
            title: doc.title,
            type: doc.type,
            content: doc.content,
            tags: ["spec", doc.type],
            status: "draft",
            createdBy: new mongoose.Types.ObjectId(session.user.id),
            updatedBy: new mongoose.Types.ObjectId(session.user.id)
          });

          // Index document in Knowledge Index
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

        // Create system activity event
        const activityMsg = `HiveMind discovered and initialized ${nodes.length} nodes, ${edges.length} connections, and ${documents.length} specifications.`;
        await Activity.create({
          hiveId: new mongoose.Types.ObjectId(hiveId),
          type: "system",
          title: "Project Brain Discovered",
          description: activityMsg,
          actorName: "HiveMind",
          timestamp: new Date()
        });

        // Publish activity to Redis
        if (redis) {
          await redis.publish("hiveos:activity", JSON.stringify({
            hiveId,
            activity: {
              type: "system",
              title: "Project Brain Discovered",
              description: activityMsg,
              actorName: "HiveMind",
              timestamp: new Date().toISOString()
            }
          }));

          // Invalidate graph cache
          await redis.del(`hive:${hiveId}:graph`);
        }

        return NextResponse.json({ success: true });

      } catch (err: any) {
        console.error("[Onboarding API] Parse error in finalize:", err);
        return NextResponse.json({ error: "Malformed JSON returned from LLM during finalization." }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (err: any) {
    console.error("[POST /api/hives/[hiveId]/onboarding/chat]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
