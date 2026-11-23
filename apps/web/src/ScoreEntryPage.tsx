import { useState, type FormEvent } from "react";
import type { Alliance, DemoData, ScoreSheetState, ScoreSheets } from "./types";

interface ScoreEntryPageProps {
  data: DemoData;
  onScoresUpdated: () => Promise<void>;
}

const emptySheets = (): ScoreSheets => ({
  red: { minorFouls: "0", majorFouls: "0", entries: {} },
  blue: { minorFouls: "0", majorFouls: "0", entries: {} },
});

function getInitialSheets(data: DemoData): ScoreSheets {
  const sheets = emptySheets();
  for (const savedScore of data.match.scores) {
    const sheet = sheets[savedScore.alliance];
    sheet.minorFouls = String(savedScore.minorFouls);
    sheet.majorFouls = String(savedScore.majorFouls);
    for (const entry of savedScore.entries) {
      sheet.entries[entry.elementId] = String(entry.count);
    }
  }
  return sheets;
}

export default function ScoreEntryPage({
  data,
  onScoresUpdated,
}: ScoreEntryPageProps) {
  const [sheets, setSheets] = useState(() => getInitialSheets(data));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isCorrecting = data.match.scores.some(
    (score) => score.status === "finalized",
  );
  const teamsByAlliance = {
    red: data.match.teams.filter((team) => team.alliance === "red"),
    blue: data.match.teams.filter((team) => team.alliance === "blue"),
  };

  function updateSheet(
    alliance: Alliance,
    update: (sheet: ScoreSheetState) => ScoreSheetState,
  ) {
    setSheets((current) => ({
      ...current,
      [alliance]: update(current[alliance]),
    }));
    setNotice(null);
  }

  async function submitScores(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/matches/${data.match.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          red: {
            minorFouls: Number(sheets.red.minorFouls),
            majorFouls: Number(sheets.red.majorFouls),
            entries: data.competition.scoringConfig.phases.flatMap((phase) =>
              phase.elements.map((element) => ({
                elementId: element.id,
                count: Number(sheets.red.entries[element.id] ?? 0),
              })),
            ),
          },
          blue: {
            minorFouls: Number(sheets.blue.minorFouls),
            majorFouls: Number(sheets.blue.majorFouls),
            entries: data.competition.scoringConfig.phases.flatMap((phase) =>
              phase.elements.map((element) => ({
                elementId: element.id,
                count: Number(sheets.blue.entries[element.id] ?? 0),
              })),
            ),
          },
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "Scores could not be finalized.";
        throw new Error(message);
      }

      await onScoresUpdated();
      setNotice("Scores finalized. Competition rankings have been updated.");
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Scores could not be finalized. Check the connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-content">
      <header className="content-header">
        <div>
          <p className="eyebrow">Qualification: Match {data.match.number}</p>
          <h1>Score entry</h1>
          <p className="subheading">
            Enter both alliance score sheets. Scores are calculated and
            validated by the server.
          </p>
        </div>
        <span
          className={`status-pill status-pill--${data.match.status === "completed" ? "complete" : "upcoming"}`}
        >
          {data.match.status === "completed" ? "Finalized" : "Upcoming"}
        </span>
      </header>

      <section className="match-banner" aria-label="Match teams">
        {(["red", "blue"] as const).map((alliance) => (
          <div
            className={`match-banner__side match-banner__side--${alliance}`}
            key={alliance}
          >
            <span className="alliance-label">
              <span className="alliance-marker" aria-hidden="true" />
              {alliance === "red" ? "Red alliance" : "Blue alliance"}
            </span>
            <strong>
              {teamsByAlliance[alliance]
                .map((team) => `${team.number} ${team.name}`)
                .join(", ")}
            </strong>
          </div>
        ))}
        <div className="match-banner__score" aria-label="Saved match score">
          {data.match.scores.length === 2 ? (
            <>
              <strong>
                {data.match.scores.find((score) => score.alliance === "red")
                  ?.totalScore ?? 0}
                <span> - </span>
                {data.match.scores.find((score) => score.alliance === "blue")
                  ?.totalScore ?? 0}
              </strong>
              <span>Saved score</span>
            </>
          ) : (
            <span>Not yet scored</span>
          )}
        </div>
      </section>

      <form className="scoring-form" onSubmit={submitScores}>
        <div className="alliance-grid">
          {(["red", "blue"] as const).map((alliance) => (
            <fieldset
              className={`alliance-sheet alliance-sheet--${alliance}`}
              key={alliance}
              disabled={isSubmitting}
            >
              <legend>
                <span className="alliance-marker" aria-hidden="true" />
                {alliance === "red" ? "Red alliance" : "Blue alliance"}
              </legend>

              {data.competition.scoringConfig.phases.map((phase) => (
                <section className="score-phase" key={phase.id}>
                  <h2>{phase.label}</h2>
                  {phase.elements.map((element) => (
                    <div className="score-row" key={element.id}>
                      <label htmlFor={`${alliance}-${element.id}`}>
                        <span>{element.label}</span>
                        <small>
                          {element.points} pts
                          {element.maxCount !== null
                            ? `, max ${element.maxCount}`
                            : ""}
                        </small>
                      </label>
                      <input
                        id={`${alliance}-${element.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={element.maxCount ?? undefined}
                        step={1}
                        required
                        value={sheets[alliance].entries[element.id] ?? "0"}
                        onChange={(change) => {
                          const value = change.currentTarget.value;
                          updateSheet(alliance, (sheet) => ({
                            ...sheet,
                            entries: { ...sheet.entries, [element.id]: value },
                          }));
                        }}
                      />
                    </div>
                  ))}
                </section>
              ))}

              <section className="foul-fields" aria-label="Fouls committed">
                <h2>Fouls committed</h2>
                {(["minorFouls", "majorFouls"] as const).map((foulType) => {
                  const label =
                    foulType === "minorFouls" ? "Minor fouls" : "Major fouls";
                  const points =
                    foulType === "minorFouls"
                      ? data.competition.scoringConfig.minorFoulPoints
                      : data.competition.scoringConfig.majorFoulPoints;
                  return (
                    <div className="score-row" key={foulType}>
                      <label htmlFor={`${alliance}-${foulType}`}>
                        <span>{label}</span>
                        <small>Opponent +{points} pts each</small>
                      </label>
                      <input
                        id={`${alliance}-${foulType}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        required
                        value={sheets[alliance][foulType]}
                        onChange={(change) => {
                          const value = change.currentTarget.value;
                          updateSheet(alliance, (sheet) => ({
                            ...sheet,
                            [foulType]: value,
                          }));
                        }}
                      />
                    </div>
                  );
                })}
              </section>
            </fieldset>
          ))}
        </div>

        {error && (
          <p className="feedback feedback--error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="feedback feedback--success" role="status">
            {notice}
          </p>
        )}

        <div className="form-actions">
          <p>
            {isCorrecting
              ? "Corrections are recorded in the score audit."
              : "Both score sheets will be finalized together."}
          </p>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving scores…"
              : isCorrecting
                ? "Save correction"
                : "Finalize match"}
          </button>
        </div>
      </form>
    </div>
  );
}
