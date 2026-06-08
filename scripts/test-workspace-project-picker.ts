/**
 * Verifies multi-project ZOE picker: all projects listed, ZOE matches suggested,
 * preselect prefers suggested project with BAU jobs.
 *
 * Run: npx tsx scripts/test-workspace-project-picker.ts
 */
import type { Project } from "../src/lib/types/project";
import type { ProjectJob } from "../src/lib/types/wip";
import {
  buildProjectPickerPlanFromProjects,
  buildSplitPlanFromPickerWithProjects,
  findProjectByExactName,
  jobsMatchingToken,
  parseSplitJobsRequest,
  rankProjectIdsByHint,
} from "../src/lib/assistant/workspace-split-jobs";

function mockProject(id: number, name: string, clientName: string): Project {
  return {
    id,
    name,
    client: { id: id * 10, name: clientName, avatar_url: null },
    status: "IN DEVELOPMENT",
  } as Project;
}

function mockJob(id: string, projectId: number, name: string): ProjectJob {
  return {
    id,
    project_id: projectId,
    name,
    subtitle: "",
    type: "PRINT",
    lead_vendor: "",
    category: "",
    style_number: "",
    status: "Upcoming",
    due_date: null,
    updated_at: new Date().toISOString(),
    timeline: [],
  } as ProjectJob;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const USER_MSG =
  "remove all the BAU items from the current ZOE project, and create a BAU boxers project, and add all the BAU items to the BAU project";

const projects = [
  mockProject(1, "ZOE Conference Tees and Hoodie", "ZOE Conference"),
  mockProject(2, "ZOE Spring Pop-up", "ZOE Conference"),
  mockProject(3, "Acme Corp Capsule", "Acme Corp"),
];

const jobsByProject: Record<number, ProjectJob[]> = {
  1: [
    mockJob("j1", 1, "ZOE Event Tee"),
    mockJob("j2", 1, "BAU01 Born Again Boxer Shorts"),
    mockJob("j3", 1, "BAU01 Born Again Boxer Shorts - 2nd Sample Corrections"),
    mockJob("j4", 1, "BAU01 Born Again Boxer Shorts"),
    mockJob("j5", 1, "ZOE Hoodie"),
  ],
  2: [mockJob("j6", 2, "ZOE Tee 2"), mockJob("j7", 2, "ZOE Crew")],
  3: [mockJob("j8", 3, "Acme Hat")],
};

// --- parse ---
const parsed = parseSplitJobsRequest(USER_MSG);
assert(parsed !== null, "parses user message");
assert(parsed!.sourceProjectHint === "ZOE", `source hint is ZOE (got ${parsed!.sourceProjectHint})`);
assert(parsed!.targetProjectName === "BAU boxers", "target is BAU boxers");
assert(parsed!.jobToken === "BAU", "job token is BAU");

// --- rank: multiple ZOE projects suggested ---
const ranked = rankProjectIdsByHint(projects, "ZOE");
assert(ranked.includes(1), "ranks ZOE Conference Tees project");
assert(ranked.includes(2), "ranks ZOE Spring Pop-up project");
assert(!ranked.includes(3), "does not rank unrelated Acme project");
assert(ranked[0] === 1 || ranked[0] === 2, "top rank is a ZOE project");

// --- picker: all projects, ZOE suggested, BAU-heavy preselected ---
const picker = buildProjectPickerPlanFromProjects(
  projects,
  (p) => jobsByProject[p.id] ?? [],
  parsed!,
);

assert(picker.projects.length === 3, "lists every workspace project");
const suggested = picker.projects.filter((p) => p.suggested);
assert(suggested.length >= 2, "suggests multiple ZOE projects");
assert(
  suggested.every((p) => p.name.includes("ZOE") || p.clientName.includes("ZOE")),
  "suggested projects are ZOE-related",
);
assert(
  !suggested.some((p) => p.name.includes("Acme")),
  "non-matching Acme project is not suggested",
);

const acmeEntry = picker.projects.find((p) => p.id === 3);
assert(Boolean(acmeEntry && !acmeEntry.suggested), "Acme still listed but not suggested");

assert(picker.selectedProjectId === 1, "preselects ZOE Conference (3 BAU jobs)");
const selected = picker.projects.find((p) => p.id === picker.selectedProjectId);
assert(selected?.matchingJobCount === 3, "preselected project has 3 BAU jobs");

// --- user can switch to other ZOE project (no BAU) ---
const altPicker = { ...picker, selectedProjectId: 2 };
const jobsFor = (p: Project) => jobsByProject[p.id] ?? [];
const altBuilt = buildSplitPlanFromPickerWithProjects(altPicker, 2, projects, jobsFor);
assert(!altBuilt.ok, "ZOE Spring has no BAU jobs — cannot split");

// --- confirm path on correct project ---
const built = buildSplitPlanFromPickerWithProjects(picker, 1, projects, jobsFor);
assert(built.ok, "builds split plan for ZOE Conference");
if (built.ok) {
  assert(built.plan.jobsToMove.length === 3, "moves 3 BAU jobs");
  assert(
    built.plan.jobsToMove.every((j) => j.name.toLowerCase().includes("bau")),
    "only BAU jobs selected",
  );
  assert(built.plan.targetProjectName === "BAU boxers", "target project name preserved");
  assert(built.plan.sourceProject.name === "ZOE Conference Tees and Hoodie", "source project correct");
}

// --- job matching unit ---
const bauJobs = jobsMatchingToken(jobsByProject[1]!, "BAU");
assert(bauJobs.length === 3, "jobsMatchingToken finds 3 BAU jobs on project 1");

assert(picker.targetProjectExists === false, "target does not exist yet in fixture");

const projectsWithBau = [
  ...projects,
  mockProject(4, "BAU boxers", "ZOE Conference"),
];
const pickerExisting = buildProjectPickerPlanFromProjects(
  projectsWithBau,
  (p) => jobsByProject[p.id] ?? [],
  parsed!,
);
assert(pickerExisting.targetProjectExists === true, "detects existing BAU boxers project");
assert(
  findProjectByExactName(projectsWithBau, "bau boxers")?.id === 4,
  "findProjectByExactName is case-insensitive",
);

console.log("PASS: workspace project picker");
console.log("  Projects shown:", picker.projects.map((p) => p.name).join(", "));
console.log(
  "  Suggested:",
  suggested.map((p) => `${p.name} (${p.matchingJobCount} BAU)`).join("; "),
);
console.log("  Preselected:", selected?.name, `(${selected?.matchingJobCount} BAU jobs)`);
