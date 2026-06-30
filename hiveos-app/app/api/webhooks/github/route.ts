import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import GithubEvent from "@/server/models/GithubEvent";
import Activity from "@/server/models/Activity";
import ProcessedWebhookEvent from "@/server/models/ProcessedWebhookEvent";
import CanvasNode from "@/server/models/CanvasNode";
import { redis } from "@/lib/redis";
import mongoose from "mongoose";
import { indexActivity } from "@/server/utils/knowledgeIndexService";

function verifySignature(payload: string, secret: string, signatureHeader: string): boolean {
  if (!signatureHeader) return false;
  try {
    const hash = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    
    const expectedSignature = `sha256=${hash}`;
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

async function findGraphLinks(hiveId: string, text: string) {
  try {
    const linkedNodeIds = new Set<string>();
    const graphLinks: any[] = [];
    const hiveObjectId = new mongoose.Types.ObjectId(hiveId);

    // 1. Explicit ticket regex: match #42, issue:42, task:42, feature:42
    const ticketRegex = /(?:#|issue:|task:|feature:)(\d+)/gi;
    const numRefs: string[] = [];
    let match;
    while ((match = ticketRegex.exec(text)) !== null) {
      if (match[1]) {
        numRefs.push(match[1]);
      }
    }

    if (numRefs.length > 0) {
      const regexPatterns = numRefs.map(num => new RegExp(`(?:#|\\b)${num}\\b`, "i"));
      const explicitNodes = await CanvasNode.find({
        hiveId: hiveObjectId,
        $or: [
          { tags: { $in: numRefs } },
          { tags: { $in: numRefs.map(num => `issue:${num}`) } },
          { tags: { $in: numRefs.map(num => `task:${num}`) } },
          { tags: { $in: numRefs.map(num => `feature:${num}`) } },
          { title: { $in: regexPatterns } }
        ]
      }).exec();

      for (const node of explicitNodes) {
        if (!linkedNodeIds.has(node.id)) {
          linkedNodeIds.add(node.id);
          graphLinks.push({
            nodeId: node.id,
            source: "regex_hashtag",
            confidence: 1.0
          });
        }
      }
    }

    // 2. Keyword heuristics
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3 && !["fixes", "resolve", "closes", "update", "commit", "github", "event", "issue", "pull", "request", "pushed"].includes(w));

    if (words.length > 0) {
      // Limit regex patterns to prevent heavy regex performance hits (max 10 words)
      const keywordRegexList = words.slice(0, 10);
      const heuristicNodes = await CanvasNode.find({
        hiveId: hiveObjectId,
        $or: [
          { title: { $regex: new RegExp(keywordRegexList.join("|"), "i") } },
          { tags: { $in: words } }
        ]
      }).exec();

      for (const node of heuristicNodes) {
        if (!linkedNodeIds.has(node.id)) {
          linkedNodeIds.add(node.id);
          graphLinks.push({
            nodeId: node.id,
            source: "keyword_heuristic",
            confidence: 0.6
          });
        }
      }
    }

    return graphLinks;
  } catch (err) {
    console.error("[findGraphLinks] Error parsing links:", err);
    return [];
  }
}

import { wrapApiRoute } from "@/lib/apiWrapper";

export const POST = wrapApiRoute(async (request, context, reqLogger) => {
  const signatureHeader = request.headers.get("x-hub-signature-256") || "";
  const eventType = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery");

  if (!deliveryId || !eventType) {
    return NextResponse.json({ error: "Missing required GitHub webhook headers" }, { status: 400 });
  }

  // Reject requests without signature headers immediately (Prevent bypass)
  if (!signatureHeader) {
    reqLogger.warn(`Webhook blocked: Missing x-hub-signature-256 header.`);
    return NextResponse.json({ error: "Unauthorized: Missing signature header" }, { status: 401 });
  }

  const rawBody = await request.text();
  const payload = JSON.parse(rawBody);

  // Check if ping event (sent by GitHub when configuring webhooks)
  if (eventType === "ping") {
    return NextResponse.json({ message: "pong" }, { status: 200 });
  }

  // Get repository details
  const repoName = payload.repository?.name;
  const ownerName = payload.repository?.owner?.login || payload.repository?.owner?.name;

  if (!repoName || !ownerName) {
    return NextResponse.json({ error: "Missing repository information in payload" }, { status: 400 });
  }

  await connectDB();

  reqLogger.info(`Received webhook eventType="${eventType}" deliveryId="${deliveryId}" for repo: ${ownerName}/${repoName}`);

  // Find all Hives connected to this repo
  const hives = await Hive.find({
    "githubRepo.owner": ownerName,
    "githubRepo.repo": repoName,
    "githubRepo.status": "connected",
  });

  if (hives.length === 0) {
    reqLogger.info(`No active Hive connection found for repo: ${ownerName}/${repoName}`);
    return NextResponse.json({ message: "No active Hive connection found for this repository" }, { status: 200 });
  }

  // Verify signature against matching Hive secrets
  let signatureValid = false;
  for (const hive of hives) {
    const secret = hive.githubRepo?.webhookSecret;
    if (secret && verifySignature(rawBody, secret, signatureHeader)) {
      signatureValid = true;
      break;
    }
  }

  if (!signatureValid) {
    reqLogger.warn(`Webhook blocked: Signature verification failed for repo: ${ownerName}/${repoName}`);
    return NextResponse.json({ error: "Unauthorized: Invalid signature" }, { status: 401 });
  }

  // Enforce idempotency check globally (deliveryId is unique per GitHub delivery)
  // We insert at the start to act as an atomic lock
  try {
    await ProcessedWebhookEvent.create({ deliveryId });
  } catch (err: any) {
    if (err.code === 11000) {
      reqLogger.info(`Event ${deliveryId} already processed (idempotency check matched)`);
      return NextResponse.json({ message: "Event already processed" }, { status: 200 });
    }
    throw err;
  }

  let processedCount = 0;

  try {
    for (const hive of hives) {
      // Check if matching secret for this specific hive passes (since different hives could theoretically use different secrets)
      const secret = hive.githubRepo?.webhookSecret;
      if (secret && !verifySignature(rawBody, secret, signatureHeader)) {
        continue;
      }

      // Save raw event log
      await GithubEvent.create({
        deliveryId,
        hiveId: hive._id,
        eventType,
        action: payload.action || null,
        payload,
      });

      // Parse details into a human-readable activity format
      let type = `github_${eventType}`;
      let title = `GitHub event: ${eventType}`;
      let description = "";
      const actorName = payload.sender?.login || "github-user";
      const actorAvatar = payload.sender?.avatar_url || "";

      if (eventType === "push") {
        const ref = payload.ref || "";
        const branch = ref.replace("refs/heads/", "");
        const commits = payload.commits || [];
        type = "github_commit";
        title = `Pushed to ${branch}`;
        description = commits.length > 0 
          ? `${commits.length} commit(s): "${commits[0].message}"` 
          : "Pushed changes";
      } else if (eventType === "pull_request") {
        const action = payload.action; // opened, closed, reopened, edited, etc.
        const pr = payload.pull_request || {};
        const isMerged = action === "closed" && pr.merged === true;
        
        type = isMerged ? "github_pr_merge" : action === "closed" ? "github_pr_close" : "github_pr_open";
        title = isMerged 
          ? `Merged PR #${pr.number}` 
          : `${action.charAt(0).toUpperCase() + action.slice(1)} PR #${pr.number}`;
        description = pr.title || "";
      } else if (eventType === "issues") {
        const action = payload.action; // opened, closed, reopened, etc.
        const issue = payload.issue || {};
        
        type = action === "opened" ? "github_issue_open" : action === "closed" ? "github_issue_close" : `github_issue_${action}`;
        title = `${action.charAt(0).toUpperCase() + action.slice(1)} Issue #${issue.number}`;
        description = issue.title || "";
      } else if (eventType === "issue_comment") {
        const action = payload.action;
        const comment = payload.comment || {};
        const issue = payload.issue || {};
        
        type = "github_comment_create";
        title = `Comment on Issue #${issue.number}`;
        description = comment.body || "";
      }

      // Scan payload text to find heuristics-based node links
      let textToScan = `${title} ${description}`;
      if (eventType === "push") {
        const commits = payload.commits || [];
        textToScan += " " + commits.map((c: any) => c.message).join(" ");
      } else if (eventType === "pull_request") {
        textToScan += " " + (payload.pull_request?.body || "");
      } else if (eventType === "issues") {
        textToScan += " " + (payload.issue?.body || "");
      } else if (eventType === "issue_comment") {
        textToScan += " " + (payload.comment?.body || "");
      }

      const graphLinks = await findGraphLinks(hive._id.toString(), textToScan);

      // Save formatted activity
      const activity = await Activity.create({
        hiveId: hive._id,
        type,
        title,
        description,
        actorName,
        actorAvatar,
        graphLinks,
        timestamp: new Date(),
      });

      // Index activity in unified search
      await indexActivity(activity._id);

      // Publish activity to Redis Pub/Sub
      if (redis) {
        const message = JSON.stringify({
          hiveId: hive._id.toString(),
          activity: {
            id: activity._id.toString(),
            hiveId: hive._id.toString(),
            type,
            title,
            description,
            actorName,
            actorAvatar,
            graphLinks,
            timestamp: activity.timestamp.toISOString(),
          },
        });
        
        await redis.publish("hiveos:activity", message);
        reqLogger.info(`Published activity event to Redis for hive ${hive._id}`);
      }

      processedCount++;
    }
  } catch (err) {
    // Clean up idempotency record so GitHub can retry the delivery if it failed
    await ProcessedWebhookEvent.deleteOne({ deliveryId });
    throw err;
  }

  return NextResponse.json({ 
    success: true, 
    processedHivesCount: processedCount 
  }, { status: 200 });
});
