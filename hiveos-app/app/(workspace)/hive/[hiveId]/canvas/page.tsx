import type { Metadata } from "next";
import { CanvasBoard } from "@/features/canvas/components/CanvasBoard";

export const metadata: Metadata = {
  title: "Canvas",
};

interface CanvasPageProps {
  params: Promise<{ hiveId: string }>;
}

export default async function CanvasPage({ params }: CanvasPageProps) {
  const { hiveId } = await params;

  return (
    <div className="h-full w-full relative">
      <CanvasBoard hiveId={hiveId} />
    </div>
  );
}
