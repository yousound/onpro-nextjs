import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/mock/projects";
import { ProjectDetailGate } from "@/components/project-detail-gate";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const num = Number(id);
  if (!Number.isFinite(num)) {
    notFound();
  }
  const staticProject = getProjectById(num) ?? null;
  return <ProjectDetailGate id={num} staticProject={staticProject} />;
}
