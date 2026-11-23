import Link from "next/link";
import { can } from "@fcm/shared";
import { notFound, redirect } from "next/navigation";
import ScoreEntryPage from "@/ScoreEntryPage";
import { getMatchCompetitionData } from "@/lib/competition-data";
import { PermissionError, requireMatchPermission } from "@/lib/permissions";

export default async function MatchScoreRoute({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  let access;
  try {
    access = await requireMatchPermission(matchId, "results.view");
  } catch (error) {
    if (error instanceof PermissionError && error.status === 401) {
      redirect("/login");
    }
    if (error instanceof PermissionError && error.status === 404) {
      notFound();
    }
    if (error instanceof PermissionError && error.status === 403) {
      return (
        <section className="panel not-found-panel">
          <p className="eyebrow">ACCESS DENIED</p>
          <h1>You do not have access to this match.</h1>
          <Link className="button button--primary" href="/workspace/matches">
            Return to matches
          </Link>
        </section>
      );
    }
    throw error;
  }

  const data = await getMatchCompetitionData(matchId);
  if (!data) notFound();

  return (
    <ScoreEntryPage
      canCorrect={can(access.user, access.roles, "score.correct")}
      canFinalize={can(access.user, access.roles, "score.finalize")}
      canSubmit={can(access.user, access.roles, "score.submit")}
      data={data}
    />
  );
}
