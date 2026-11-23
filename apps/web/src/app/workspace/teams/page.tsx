import { notFound } from "next/navigation";
import { TeamsPage } from "@/App";
import { getDemoCompetitionData } from "@/lib/competition-data";
import { requireCompetitionPagePermission } from "@/lib/page-permissions";

export default async function WorkspaceTeamsPage() {
  const data = await getDemoCompetitionData();
  if (!data) notFound();
  await requireCompetitionPagePermission(data.competition.id, "results.view");
  return <TeamsPage data={data} />;
}
