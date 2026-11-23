import { notFound } from "next/navigation";
import { MatchesPage } from "@/App";
import { getDemoCompetitionData } from "@/lib/competition-data";
import { requireCompetitionPagePermission } from "@/lib/page-permissions";

export default async function WorkspaceMatchesPage() {
  const data = await getDemoCompetitionData();
  if (!data) notFound();
  await requireCompetitionPagePermission(data.competition.id, "results.view");
  return <MatchesPage data={data} />;
}
