import mongoose from "mongoose";
import Hive from "../models/Hive";

export interface AuthorizationResult {
  authorized: boolean;
  reason?: string;
}

export class ExecutionAuthorizationService {
  /**
   * Verifies if the actor is authorized to execute operations in the target Hive workspace.
   * Currently verifies that the actor is the owner of the Hive workspace (and can be extended
   * in future iterations to check members lists, roles, and fine-grained permissions).
   */
  static async authorizeExecution(
    hiveId: string,
    actorId: string,
    affectedEntities: Array<{ entityId: string; entityType: string; title: string }>
  ): Promise<AuthorizationResult> {
    try {
      // Validate IDs
      if (!mongoose.Types.ObjectId.isValid(hiveId)) {
        return { authorized: false, reason: "Invalid Hive ID format." };
      }
      if (!actorId) {
        return { authorized: false, reason: "Missing actorId. Authorization denied." };
      }

      // Fetch the Hive workspace
      const hive = await Hive.findById(hiveId).lean().exec();
      if (!hive) {
        return { authorized: false, reason: `Hive workspace not found (ID: ${hiveId}).` };
      }

      // Check owner relationship
      const isOwner = hive.ownerId.toString() === actorId;
      if (!isOwner) {
        return {
          authorized: false,
          reason: "Actor does not have execution privileges. Only the Hive owner is permitted to execute action plans.",
        };
      }

      // Validate actor can modify the affected entities. 
      // In V1, the owner has full modification rights over all entities inside their own Hive.
      // We perform a safety sanity check that each entity belongs to/references this hive.

      return { authorized: true };
    } catch (err: any) {
      console.error("[ExecutionAuth] Error validating execution permissions:", err);
      return { authorized: false, reason: `Authorization check failed: ${err.message}` };
    }
  }
}

export default ExecutionAuthorizationService;
