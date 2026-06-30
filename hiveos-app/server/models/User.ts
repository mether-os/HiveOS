/**
 * server/models/User.ts — Mongoose User Schema
 *
 * Purpose: Defines the MongoDB document structure for authenticated users.
 *
 * Why here and not in lib/? This file imports Mongoose models which can only
 * run in Node.js (not in the browser or Edge runtime). Placing it under
 * server/ enforces that boundary — Next.js will error at build time if a
 * client component tries to import from server/.
 *
 * Better Auth integration: Better Auth manages its own user storage via its
 * MongoDB adapter. However, we maintain our OWN User model to:
 * 1. Add application-specific fields (avatar, githubId, googleId)
 * 2. Use as a foreign key reference in Hives, Tasks, etc.
 * 3. Keep full control over the schema as the app evolves
 *
 * Better Auth will create/update its internal user records. Our model is kept
 * in sync via the `user` table that Better Auth creates. The Better Auth userId
 * IS the MongoDB ObjectId we reference in Hives.
 *
 * Interactions:
 * - Referenced by: server/models/Hive.ts (ownerId -> User)
 * - Used by: server/actions/*.ts (data access layer)
 * - Never used by: app/ client components directly
 */

import mongoose, { type HydratedDocument, Schema, type Types } from "mongoose";

// ---------------------------------------------------------------------------
// TypeScript Interface — the shape of a User document
// ---------------------------------------------------------------------------

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string;
  // OAuth provider IDs — populated on first OAuth login
  // Used to link accounts if a user logs in with different providers
  githubId?: string;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<IUser>;

// ---------------------------------------------------------------------------
// Mongoose Schema Definition
// ---------------------------------------------------------------------------

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      // Basic email format validation
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    image: {
      type: String,
      // Avatar URL from OAuth provider (GitHub/Google)
      trim: true,
    },

    githubId: {
      type: String,
      sparse: true, // Sparse index — allows multiple null values
      index: true,
    },

    googleId: {
      type: String,
      sparse: true,
      index: true,
    },
  },
  {
    // Automatically adds createdAt and updatedAt fields
    timestamps: true,

    // Convert _id to string 'id' when serializing to JSON
    // This makes API responses use { id: "..." } instead of { _id: "..." }
    toJSON: {
      virtuals: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Email index for lookups during auth is already defined inline on the email field.

// ---------------------------------------------------------------------------
// Model Registration — handles Next.js hot-reload
// If the model already exists in Mongoose's registry, reuse it.
// Without this, hot-reload throws "Cannot overwrite model once compiled".
// ---------------------------------------------------------------------------
const User =
  (mongoose.models["User"] as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);

export default User;
