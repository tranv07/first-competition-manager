import Link from "next/link";
import type { ReactNode } from "react";
import SignOutButton from "./SignOutButton";
import WorkspaceNav from "./WorkspaceNav";
import type { DemoData, RankingRow } from "./types";

export function AppFrame({
  data,
  currentUser,
  canManageUsers,
  canAdmin,
  children,
}: {
  data: DemoData;
  currentUser: { name: string; email: string };
  canManageUsers: boolean;
  canAdmin?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link
          className="brand"
          href="/workspace"
          aria-label="FIRST Competition Manager home"
        >
          <span className="brand-mark" aria-hidden="true">
            F
          </span>
          <span className="brand-name">
            <strong>FIRST</strong>
            <small>Competition Manager</small>
          </span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>
        <WorkspaceNav
          competitionId={data.competition.id}
          canManageUsers={canManageUsers}
          canAdmin={canAdmin}
        />

        <div className="sidebar-event">
          <div className="sidebar-label">CURRENT EVENT</div>
          <span className="event-indicator" aria-hidden="true" />
          <strong>{data.competition.name}</strong>
          <span>{data.competition.location ?? "Location to be announced"}</span>
          <Link href="/workspace/events">View event</Link>
        </div>

        <div className="sidebar-footer">
          <span className="local-indicator" aria-hidden="true" />
          Local development workspace
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span aria-hidden="true">/</span>
            <strong>{data.competition.name}</strong>
          </div>
          <div className="user-chip">
            <span className="user-avatar" aria-hidden="true">
              D
            </span>
            <span>
              <strong>{currentUser.name}</strong>
              <small>{currentUser.email}</small>
            </span>
            <SignOutButton />
          </div>
        </header>
        <main className="route-content">{children}</main>
      </div>
    </div>
  );
}

function formatEventDate(startDate: string, endDate: string): string {
  const start = new Date(`${startDate.slice(0, 10)}T00:00:00`);
  const end = new Date(`${endDate.slice(0, 10)}T00:00:00`);
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  if (startDate.slice(0, 10) === endDate.slice(0, 10)) {
    return start.toLocaleDateString(undefined, options);
  }
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} to ${end.toLocaleDateString(undefined, options)}`;
}

export function RankingTable({ rankings }: { rankings: RankingRow[] }) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="visually-hidden">
          Qualification team rankings
        </caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Team</th>
            <th scope="col">Played</th>
            <th scope="col">W-L-T</th>
            <th scope="col">RP</th>
            <th scope="col">TBP</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {rankings.map((ranking) => (
            <tr key={ranking.teamId ?? ranking.teamNumber}>
              <td>
                <span className="rank-number">{ranking.rank}</span>
              </td>
              <th scope="row">
                <span className="ranking-team-number">
                  {ranking.teamNumber}
                </span>
                {ranking.teamName}
              </th>
              <td>{ranking.matchesPlayed}</td>
              <td>
                {ranking.wins}-{ranking.losses}-{ranking.ties}
              </td>
              <td>{ranking.rankingPoints}</td>
              <td>{ranking.tiebreakerPoints}</td>
              <td>{ranking.totalPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HomePage({ data }: { data: DemoData }) {
  const matchesPlayed = data.rankings.reduce(
    (max, ranking) => Math.max(max, ranking.matchesPlayed),
    0,
  );
  const finalized = data.match.status === "completed";
  const redScore = data.match.scores.find(
    (score) => score.alliance === "red",
  )?.totalScore;
  const blueScore = data.match.scores.find(
    (score) => score.alliance === "blue",
  )?.totalScore;

  return (
    <div className="page-content">
      <header className="welcome-hero">
        <div className="welcome-copy">
          <p className="eyebrow eyebrow--light">EVENT CONTROL CENTER</p>
          <h1>Good competition starts with a great plan.</h1>
          <p>
            Keep teams, match operations, scores, and standings moving together
            from one place.
          </p>
          <div className="hero-actions">
            <Link
              className="button button--light"
              href={`/workspace/matches/${data.match.id}/score`}
            >
              {finalized ? "Review match score" : "Enter match score"}
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="hero-secondary-link" href="/workspace/events">
              Explore event
            </Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art__ring hero-art__ring--outer" />
          <div className="hero-art__ring hero-art__ring--inner" />
          <div className="hero-art__cross hero-art__cross--one" />
          <div className="hero-art__cross hero-art__cross--two" />
          <div className="hero-art__orb">F</div>
          <span className="hero-art__label">EVENT OVERVIEW</span>
        </div>
      </header>

      <section className="stats-grid" aria-label="Event at a glance">
        <article className="stat-card">
          <span className="stat-card__label">Registered teams</span>
          <strong>{data.competition.registeredTeams.length}</strong>
          <span className="stat-card__note">Teams in this event</span>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Qualification matches</span>
          <strong>1</strong>
          <span className="stat-card__note">Demo match scheduled</span>
        </article>
        <article className="stat-card">
          <span className="stat-card__label">Matches played</span>
          <strong>{matchesPlayed}</strong>
          <span className="stat-card__note">
            {finalized ? "Match 1 finalized" : "Ready to get started"}
          </span>
        </article>
        <article className="stat-card stat-card--status">
          <span className="stat-card__label">Event status</span>
          <strong>
            <span className="status-dot" aria-hidden="true" />
            {data.competition.status}
          </strong>
          <span className="stat-card__note">Competition workspace</span>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="panel next-match-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                {finalized ? "LATEST RESULT" : "UP NEXT"}
              </p>
              <h2>Qualification 1</h2>
            </div>
            <span
              className={`status-pill status-pill--${finalized ? "complete" : "upcoming"}`}
            >
              {finalized ? "Finalized" : "Upcoming"}
            </span>
          </div>
          <div className="score-preview">
            <div className="score-preview__alliance score-preview__alliance--red">
              <span className="alliance-label">
                <span className="alliance-marker" aria-hidden="true" />
                Red alliance
              </span>
              <strong>
                {data.match.teams
                  .filter((team) => team.alliance === "red")
                  .map((team) => team.number)
                  .join(", ")}
              </strong>
            </div>
            <div className="score-preview__result">
              {finalized ? (
                <strong>
                  {redScore ?? 0} <span>-</span> {blueScore ?? 0}
                </strong>
              ) : (
                <span>VS</span>
              )}
            </div>
            <div className="score-preview__alliance score-preview__alliance--blue">
              <span className="alliance-label">
                <span className="alliance-marker" aria-hidden="true" />
                Blue alliance
              </span>
              <strong>
                {data.match.teams
                  .filter((team) => team.alliance === "blue")
                  .map((team) => team.number)
                  .join(", ")}
              </strong>
            </div>
          </div>
          <div className="panel-footer">
            <span>
              {data.match.scheduledTime
                ? new Date(data.match.scheduledTime).toLocaleString()
                : "Field 1, Qualification"}
            </span>
            <Link href={`/workspace/matches/${data.match.id}/score`}>
              {finalized ? "Review score" : "Open score sheet"}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section className="panel event-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">YOUR EVENT</p>
              <h2>{data.competition.name}</h2>
            </div>
            <span className="event-card__mark" aria-hidden="true">
              FTC
            </span>
          </div>
          <div className="event-details">
            <div>
              <span className="detail-icon" aria-hidden="true">
                01
              </span>
              <span>
                {formatEventDate(
                  data.competition.startDate,
                  data.competition.endDate,
                )}
              </span>
            </div>
            <div>
              <span className="detail-icon" aria-hidden="true">
                02
              </span>
              <span>
                {data.competition.location ?? "Location to be announced"}
              </span>
            </div>
            <div>
              <span className="detail-icon" aria-hidden="true">
                03
              </span>
              <span>
                {data.competition.registeredTeams.length} registered teams
              </span>
            </div>
          </div>
          <Link className="text-link" href="/workspace/events">
            View event details <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>

      <section className="panel rankings-preview">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">COMPETITION STANDINGS</p>
            <h2>Qualification rankings</h2>
          </div>
          <Link className="text-link" href="/workspace/rankings">
            View all rankings <span aria-hidden="true">→</span>
          </Link>
        </div>
        {data.rankings.length > 0 ? (
          <RankingTable rankings={data.rankings.slice(0, 5)} />
        ) : (
          <div className="empty-panel">
            <span className="empty-panel__mark" aria-hidden="true">
              R
            </span>
            <div>
              <h3>Standings take shape after the first match</h3>
              <p>
                Finalize a match score to calculate ranking points and publish
                the live leaderboard.
              </p>
            </div>
            <Link
              className="button button--outline"
              href={`/workspace/matches/${data.match.id}/score`}
            >
              Go to scoring
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

export function EventPage({ data }: { data: DemoData }) {
  return (
    <div className="page-content">
      <header className="content-header">
        <div>
          <p className="eyebrow">EVENT MANAGEMENT</p>
          <h1>{data.competition.name}</h1>
          <p className="subheading">
            Competition details, registered teams, and live operations.
          </p>
        </div>
        <span className="status-pill status-pill--upcoming">
          {data.competition.status}
        </span>
      </header>
      <section className="event-detail-grid">
        <article className="panel event-detail-feature">
          <span
            className="event-card__mark event-card__mark--large"
            aria-hidden="true"
          >
            FTC
          </span>
          <p className="eyebrow">FIRST TECH CHALLENGE</p>
          <h2>{data.competition.name}</h2>
          <p>
            A local demo event for testing team registration, match scoring, and
            competition rankings.
          </p>
          <Link
            className="button button--primary"
            href={`/workspace/matches/${data.match.id}/score`}
          >
            Open Match 1 score sheet <span aria-hidden="true">→</span>
          </Link>
        </article>
        <article className="panel event-facts">
          <h2>Event details</h2>
          <dl>
            <div>
              <dt>Dates</dt>
              <dd>
                {formatEventDate(
                  data.competition.startDate,
                  data.competition.endDate,
                )}
              </dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{data.competition.location ?? "To be announced"}</dd>
            </div>
            <div>
              <dt>Program</dt>
              <dd>FIRST Tech Challenge</dd>
            </div>
            <div>
              <dt>Scoring config</dt>
              <dd>FTC Into the Deep</dd>
            </div>
            <div>
              <dt>Registered teams</dt>
              <dd>{data.competition.registeredTeams.length}</dd>
            </div>
          </dl>
        </article>
      </section>
      <section className="panel event-operations">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">EVENT OPERATIONS</p>
            <h2>Keep the competition moving</h2>
          </div>
        </div>
        <div className="operation-links">
          <Link href="/workspace/teams">
            <span className="operation-number">01</span>
            <span>
              <strong>Team roster</strong>
              <small>Review registered teams</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link href="/workspace/matches">
            <span className="operation-number">02</span>
            <span>
              <strong>Match schedule</strong>
              <small>View and score qualification matches</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
          <Link href="/workspace/rankings">
            <span className="operation-number">03</span>
            <span>
              <strong>Live rankings</strong>
              <small>See standings and ranking points</small>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

export function TeamsPage({ data }: { data: DemoData }) {
  return (
    <div className="page-content">
      <header className="content-header">
        <div>
          <p className="eyebrow">EVENT ROSTER</p>
          <h1>Teams</h1>
          <p className="subheading">
            {data.competition.registeredTeams.length} teams registered for{" "}
            {data.competition.name}.
          </p>
        </div>
        <span className="count-badge">
          {data.competition.registeredTeams.length} teams
        </span>
      </header>
      <section className="panel directory-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">REGISTERED TEAMS</p>
            <h2>Team directory</h2>
          </div>
          <span className="muted-copy">FTC, alphabetical by team number</span>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="visually-hidden">
              Teams registered for {data.competition.name}
            </caption>
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col">Team name</th>
                <th scope="col">Competition</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.competition.registeredTeams.map((team) => (
                <tr key={team.id}>
                  <td>
                    <span className="team-number-chip">{team.number}</span>
                  </td>
                  <th scope="row">{team.name}</th>
                  <td>{data.competition.name}</td>
                  <td>
                    <span className="table-status">
                      <span className="status-dot" aria-hidden="true" />
                      Registered
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function MatchesPage({ data }: { data: DemoData }) {
  const isFinalized = data.match.status === "completed";
  return (
    <div className="page-content">
      <header className="content-header">
        <div>
          <p className="eyebrow">MATCH OPERATIONS</p>
          <h1>Matches</h1>
          <p className="subheading">
            Qualification schedule and score entry for {data.competition.name}.
          </p>
        </div>
        <span className="count-badge">1 match</span>
      </header>
      <section className="panel schedule-panel">
        <div className="schedule-heading">
          <div>
            <p className="eyebrow">QUALIFICATION</p>
            <h2>Match schedule</h2>
          </div>
          <span className="muted-copy">Field 1</span>
        </div>
        <article className="schedule-match">
          <div className="schedule-match__number">
            <span>QUAL</span>
            <strong>01</strong>
          </div>
          <div className="schedule-match__teams">
            <div className="schedule-alliance schedule-alliance--red">
              <span className="alliance-marker" aria-hidden="true" />
              <span>
                {data.match.teams
                  .filter((team) => team.alliance === "red")
                  .map((team) => `${team.number} ${team.name}`)
                  .join(", ")}
              </span>
            </div>
            <div className="schedule-alliance schedule-alliance--blue">
              <span className="alliance-marker" aria-hidden="true" />
              <span>
                {data.match.teams
                  .filter((team) => team.alliance === "blue")
                  .map((team) => `${team.number} ${team.name}`)
                  .join(", ")}
              </span>
            </div>
          </div>
          <div className="schedule-match__result">
            {isFinalized ? (
              <>
                <strong>
                  {data.match.scores.find((score) => score.alliance === "red")
                    ?.totalScore ?? 0}{" "}
                  -{" "}
                  {data.match.scores.find((score) => score.alliance === "blue")
                    ?.totalScore ?? 0}
                </strong>
                <span>Final</span>
              </>
            ) : (
              <span>Upcoming</span>
            )}
          </div>
          <Link
            className="button button--outline"
            href={`/workspace/matches/${data.match.id}/score`}
          >
            {isFinalized ? "Review score" : "Score match"}
          </Link>
        </article>
      </section>
      <p className="page-note">
        This demo schedule contains one qualification match. Schedule generation
        and playoff brackets are not part of this preview yet.
      </p>
    </div>
  );
}

export function RankingsPage({ data }: { data: DemoData }) {
  return (
    <div className="page-content">
      <header className="content-header">
        <div>
          <p className="eyebrow">LIVE STANDINGS</p>
          <h1>Rankings</h1>
          <p className="subheading">
            Qualification standings for {data.competition.name}.
          </p>
        </div>
        <span className="count-badge">
          {data.rankings.length
            ? `${data.rankings.length} teams ranked`
            : `${data.competition.registeredTeams.length} teams`}
        </span>
      </header>
      <section className="panel rankings-page-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">QUALIFICATION</p>
            <h2>Team standings</h2>
          </div>
          <span className="muted-copy">RP, TBP, total score</span>
        </div>
        {data.rankings.length > 0 ? (
          <RankingTable rankings={data.rankings} />
        ) : (
          <div className="empty-panel empty-panel--large">
            <span className="empty-panel__mark" aria-hidden="true">
              R
            </span>
            <div>
              <h3>No rankings have been calculated yet</h3>
              <p>
                Standings are generated when both alliance scores for a match
                are finalized.
              </p>
            </div>
            <Link
              className="button button--primary"
              href={`/workspace/matches/${data.match.id}/score`}
            >
              Score Qualification 1 <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <section className="panel not-found-panel">
      <p className="eyebrow">404: PAGE NOT FOUND</p>
      <h1>This page isn't in the schedule.</h1>
      <p>Head back to the workspace overview to continue.</p>
      <Link className="button button--primary" href="/workspace">
        Back to overview
      </Link>
    </section>
  );
}
