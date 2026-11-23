import Link from "next/link";
import { getPublishedCompetitions } from "@/lib/competition-data";

export const dynamic = "force-dynamic";

export default async function PublicHomePage() {
  const competitions = await getPublishedCompetitions();

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
        <Link className="button button--outline" href="/login">
          Staff sign in
        </Link>
      </header>

      <section className="public-hero">
        <p className="eyebrow eyebrow--light">FIRST COMPETITION MANAGER</p>
        <h1>Competition results, made clear.</h1>
        <p>
          Follow published events, match results, and team standings from one
          place.
        </p>
      </section>

      <section className="public-events">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">EVENTS</p>
            <h2>Published competitions</h2>
          </div>
          <span className="count-badge">{competitions.length} events</span>
        </div>
        {competitions.length > 0 ? (
          <div className="public-event-list">
            {competitions.map((competition) => (
              <article className="panel public-event-card" key={competition.id}>
                <div>
                  <p className="eyebrow">{competition.program.toUpperCase()}</p>
                  <h3>{competition.name}</h3>
                  <p>
                    {competition.location ?? "Location to be announced"} |{" "}
                    {competition._count.teams} teams |{" "}
                    {competition._count.matches} matches
                  </p>
                </div>
                <Link
                  className="button button--primary"
                  href={`/events/${competition.id}/results`}
                >
                  View results
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="panel public-empty-state">
            <h3>No published competitions yet</h3>
            <p>
              Results appear here after an event is moved out of draft status.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
