import KnowledgeIndex from "@/server/models/KnowledgeIndex";
import Document from "@/server/models/Document";
import CanvasNode from "@/server/models/CanvasNode";
import Activity from "@/server/models/Activity";
import GraphMutationEvent from "@/server/models/GraphMutationEvent";
import mongoose from "mongoose";

/**
 * Knowledge Indexing Service
 *
 * Flattens and indexes documents, nodes, activities, and timeline mutations
 * into a single unified search collection for fast weighted searches.
 */

export async function indexDocument(docId: string | mongoose.Types.ObjectId) {
  try {
    const doc = await Document.findById(docId).exec();
    if (!doc) return;

    await KnowledgeIndex.updateOne(
      { entityId: doc._id.toString() },
      {
        $set: {
          hiveId: doc.hiveId,
          entityType: "document",
          title: doc.title,
          content: doc.content || "",
          tags: doc.tags || [],
          status: doc.status,
          metadata: {
            type: doc.type,
            createdBy: doc.createdBy.toString(),
          },
          sourceUpdatedAt: doc.updatedAt,
        },
      },
      { upsert: true }
    );
    console.log(`[Indexer] Indexed document: ${doc._id}`);
  } catch (err) {
    console.error(`[Indexer] Error indexing document ${docId}:`, err);
  }
}

export async function indexNode(nodeId: string | mongoose.Types.ObjectId) {
  try {
    const node = await CanvasNode.findById(nodeId).exec();
    if (!node) return;

    await KnowledgeIndex.updateOne(
      { entityId: node.id },
      {
        $set: {
          hiveId: node.hiveId,
          entityType: "node",
          title: node.title,
          content: `${node.description || ""} ${node.category || ""}`.trim(),
          tags: node.tags || [],
          status: node.data?.status || null,
          metadata: {
            category: node.category,
            priority: node.data?.priority || null,
            createdBy: node.createdBy.toString(),
          },
          sourceUpdatedAt: node.updatedAt || node.createdAt || new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`[Indexer] Indexed canvas node: ${node.id}`);
  } catch (err) {
    console.error(`[Indexer] Error indexing canvas node ${nodeId}:`, err);
  }
}

export async function indexActivity(activityId: string | mongoose.Types.ObjectId) {
  try {
    const act = await Activity.findById(activityId).exec();
    if (!act) return;

    await KnowledgeIndex.updateOne(
      { entityId: act._id.toString() },
      {
        $set: {
          hiveId: act.hiveId,
          entityType: "activity",
          title: act.title,
          content: act.description || "",
          tags: [],
          status: null,
          metadata: {
            type: act.type,
            actorName: act.actorName,
          },
          sourceUpdatedAt: act.timestamp || new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`[Indexer] Indexed activity: ${act._id}`);
  } catch (err) {
    console.error(`[Indexer] Error indexing activity ${activityId}:`, err);
  }
}

export async function indexMutationEvent(eventId: string | mongoose.Types.ObjectId) {
  try {
    const evt = await GraphMutationEvent.findById(eventId).exec();
    if (!evt) return;

    await KnowledgeIndex.updateOne(
      { entityId: evt._id.toString() },
      {
        $set: {
          hiveId: evt.hiveId,
          entityType: "mutation",
          title: `Mutation: ${evt.eventType}`,
          content: `Actor: ${evt.actorName}. Entity: ${evt.entityId} (${evt.entityType}).`,
          tags: [],
          status: null,
          metadata: {
            eventType: evt.eventType,
            entityId: evt.entityId,
            entityType: evt.entityType,
            actorName: evt.actorName,
          },
          sourceUpdatedAt: evt.timestamp,
        },
      },
      { upsert: true }
    );
    console.log(`[Indexer] Indexed mutation event: ${evt._id}`);
  } catch (err) {
    console.error(`[Indexer] Error indexing mutation event ${eventId}:`, err);
  }
}

export async function deindexEntity(entityId: string) {
  try {
    await KnowledgeIndex.deleteOne({ entityId });
    console.log(`[Indexer] De-indexed entity: ${entityId}`);
  } catch (err) {
    console.error(`[Indexer] Error de-indexing entity ${entityId}:`, err);
  }
}

/**
 * Performs a complete index rebuild for the specified Hive.
 */
export async function bootstrapIndex(hiveId: string | mongoose.Types.ObjectId) {
  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);
  try {
    console.log(`[Indexer] Bootstrapping knowledge index for Hive: ${hiveId}`);
    
    // Clear index entries first
    await KnowledgeIndex.deleteMany({ hiveId: hiveObjectId });

    // 1. Index all documents
    const docs = await Document.find({ hiveId: hiveObjectId }).exec();
    for (const doc of docs) {
      await indexDocument(doc._id);
    }

    // 2. Index all canvas nodes
    const nodes = await CanvasNode.find({ hiveId: hiveObjectId }).exec();
    for (const node of nodes) {
      await indexNode(node._id);
    }

    // 3. Index all activities
    const activities = await Activity.find({ hiveId: hiveObjectId }).exec();
    for (const act of activities) {
      await indexActivity(act._id);
    }

    // 4. Index all mutation events
    const mutations = await GraphMutationEvent.find({ hiveId: hiveObjectId }).exec();
    for (const mut of mutations) {
      await indexMutationEvent(mut._id);
    }

    console.log(`[Indexer] Bootstrapped knowledge index successfully: ${docs.length} docs, ${nodes.length} nodes, ${activities.length} activities, ${mutations.length} mutations.`);
  } catch (err) {
    console.error(`[Indexer] Failed to bootstrap index for Hive ${hiveId}:`, err);
  }
}
