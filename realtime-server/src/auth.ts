import { Socket } from "socket.io";
import * as cookie from "cookie";
import { connectToDatabase } from "./db";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Extend SocketData type definitions to include user metadata and sessionToken
declare module "socket.io" {
  interface SocketData {
    user?: AuthenticatedUser;
    workspaceId?: string;
    sessionToken?: string;
  }
}

export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    const cookieHeader = socket.handshake.headers.cookie || "";
    const cookies = cookie.parse(cookieHeader);
    
    // Support token from cookie (main flow) or auth payload query parameters (for testing)
    const sessionToken = cookies["better-auth.session_token"] || socket.handshake.auth?.token;

    console.log(`[Realtime Auth DEBUG] Extracted sessionToken: "${sessionToken}". Cookie keys:`, Object.keys(cookies));

    if (!sessionToken) {
      console.warn(`[Realtime Auth] Unauthorized connection attempt: No session token found.`);
      return next(new Error("unauthorized_no_token"));
    }

    // Better Auth cookie format is [token].[signature]. We query MongoDB using only the raw token.
    const actualToken = sessionToken.split(".")[0];

    const db = await connectToDatabase();
    
    // Find session in Better Auth session collection
    const session = await db.collection("session").findOne({ token: actualToken });

    if (!session) {
      console.warn(`[Realtime Auth] Unauthorized: Session token not found in database for token: "${actualToken}"`);
      return next(new Error("unauthorized_invalid_session"));
    }

    // Check if session has expired
    const expiresAt = new Date(session.expiresAt);
    if (expiresAt < new Date()) {
      console.warn(`[Realtime Auth] Unauthorized: Session has expired.`);
      return next(new Error("unauthorized_session_expired"));
    }

    // Retrieve corresponding user
    // Better Auth can store userId as a string or ObjectId depending on adapter setup
    let userDoc = await db.collection("user").findOne({ id: session.userId });
    if (!userDoc) {
      userDoc = await db.collection("user").findOne({ _id: session.userId });
    }

    if (!userDoc) {
      console.warn(`[Realtime Auth] Unauthorized: User associated with session not found.`);
      return next(new Error("unauthorized_user_not_found"));
    }

    // Map database user object to our AuthenticatedUser structure
    const user: AuthenticatedUser = {
      id: userDoc.id || userDoc._id.toString(),
      name: userDoc.name,
      email: userDoc.email,
      image: userDoc.image,
      createdAt: userDoc.createdAt,
      updatedAt: userDoc.updatedAt,
    };

    // Attach to socket.data for access in event handlers and revocation checks
    socket.data.user = user;
    socket.data.sessionToken = actualToken;
    console.log(`[Realtime Auth] Authenticated user: ${user.name} (${user.email})`);
    next();
  } catch (error) {
    console.error("[Realtime Auth] Error during socket authentication middleware:", error);
    next(new Error("internal_auth_error"));
  }
}
