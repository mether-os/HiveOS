import { redirect } from "next/navigation";

/**
 * app/(workspace)/hive/[hiveId]/page.tsx — Workspace Root Redirect
 *
 * Purpose: /hive/:id redirects to /hive/:id/canvas (the default tab).
 */

interface PageProps {
  params: Promise<{ hiveId: string }>;
}

export default async function HiveRootPage({ params }: PageProps) {
  const { hiveId } = await params;
  redirect(`/hive/${hiveId}/canvas`);
}
