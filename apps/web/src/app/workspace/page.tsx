import { notFound } from "next/navigation";
import { HomePage } from "@/App";
import { getDemoCompetitionData } from "@/lib/competition-data";
import { requireCompetitionPagePermission } from "@/lib/page-permissions";

export default async function WorkspaceOverviewPage() {
  const data = await getDemoCompetitionData();
  if (!data) notFound();
  await requireCompetitionPagePermission(data.competition.id, "results.view");
  return <HomePage data={data} />;
}
