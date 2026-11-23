import Link from "next/link";
import { notFound } from "next/navigation";
import { RankingTable } from "@/App";
import { getCompetitionData } from "@/lib/competition-data";

export default async function PublicResultsPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const data = await getCompetitionData(competitionId);
  if (!data || data.competition.status === "draft") notFound();

  return (
    <main className="public-page">
      <header className="public-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span className="brand-name">
            <strong>FIRST</strong>
            <small>Competition Manager</small>
          </span>
        </Link>
        <Link className="button button--outline" href="/">
          All events
        </Link>
      </header>
      <div className="public-results">
        <header className="content-header">
          <div>
            <p className="eyebrow">PUBLIC RESULTS</p>
            <h1>{data.competition.name}</h1>
            <p className="subheading">
              {data.competition.location ?? "Location to be announced"}
            </p>
          </div>
          <span className="status-pill status-pill--complete">
            {data.competition.status}
          </span>
        </header>
        <section className="panel rankings-page-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">QUALIFICATION</p>
              <h2>Team standings</h2>
            </div>
            <span className="count-badge">
              {data.rankings.length} teams ranked
            </span>
          </div>
          {data.rankings.length ? (
            <RankingTable rankings={data.rankings} />
          ) : (
            <div className="public-empty-state">
              <h3>Rankings are not available yet</h3>
              <p>Standings will appear after match scores are finalized.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
