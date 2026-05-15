import { getProjects } from "@/lib/mock/projects";
import { ProjectsPageContent } from "@/components/projects-page-content";

export default function ProjectsPage() {
  const projects = getProjects();

  return <ProjectsPageContent initialProjects={projects} />;
}
