"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Alliance, DemoData, ScoreSheetState, ScoreSheets } from "./types";
import {
  correctMatchScores,
  finalizeMatchScores,
  saveScoreDrafts,
  submitScoreSheets,
  type ScoreActionState,
} from "./app/actions/scores";

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

function getInitialStatus(
  data: DemoData,
  alliance: Alliance,
): string | undefined {
  return data.match.scores.find((score) => score.alliance === alliance)?.status;
}

export default function ScoreEntryPage({
  data,
  canSubmit,
  canFinalize,
  canCorrect,
}: {
  data: DemoData;
  canSubmit: boolean;
  canFinalize: boolean;
  canCorrect: boolean;
}) {
  const router = useRouter();
  const [sheets, setSheets] = useState(() => getInitialSheets(data));
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<ScoreActionState | null>(null);
  const teamsByAlliance = {
    red: data.match.teams.filter((team) => team.alliance === "red"),
    blue: data.match.teams.filter((team) => team.alliance === "blue"),
  };
  const scoreStatuses = {
    red: getInitialStatus(data, "red"),
    blue: getInitialStatus(data, "blue"),
  };
  const canEditDrafts =
    canSubmit &&
    Object.values(scoreStatuses).every(
      (status) => status === undefined || status === "draft",
    );
  const canEditCorrection =
    canCorrect &&
    scoreStatuses.red === "finalized" &&
    scoreStatuses.blue === "finalized";
  const fieldsDisabled = isSubmitting || (!canEditDrafts && !canEditCorrection);
  const canFinalizeMatch =
    canFinalize &&
    scoreStatuses.red === "submitted" &&
    scoreStatuses.blue === "submitted";
  const isFinalized =
    scoreStatuses.red === "finalized" && scoreStatuses.blue === "finalized";

  function updateSheet(
    alliance: Alliance,
    update: (sheet: ScoreSheetState) => ScoreSheetState,
  ) {
    setSheets((current) => ({
      ...current,
      [alliance]: update(current[alliance]),
    }));
    setFeedback(null);
  }

  function getSubmission() {
    return {
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
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    const submitter =
      event.nativeEvent instanceof SubmitEvent
        ? event.nativeEvent.submitter
        : null;
    const action =
      submitter instanceof HTMLButtonElement ? submitter.value : "draft";

    setIsSubmitting(true);
    setFeedback(null);
    try {
      let result: ScoreActionState;
      if (action === "draft") {
        result = await saveScoreDrafts(data.match.id, getSubmission());
      } else if (action === "submit") {
        result = await submitScoreSheets(data.match.id, getSubmission());
      } else if (action === "finalize") {
        result = await finalizeMatchScores(data.match.id);
      } else if (action === "correct") {
        result = await correctMatchScores(
          data.match.id,
          getSubmission(),
          reason,
        );
        if (!result.error) setReason("");
      } else {
        setFeedback({
          message: "Choose a score action and try again.",
          error: true,
        });
        return;
      }
      setFeedback(result);
      if (!result.error) router.refresh();
    } catch {
      setFeedback({
        message: "The score update failed. Check the connection and try again.",
        error: true,
      });
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
            Draft, submit, and finalize both alliance score sheets with an
            audited correction path.
          </p>
        </div>
        <span
          className={`status-pill status-pill--${isFinalized ? "complete" : "upcoming"}`}
        >
          {isFinalized ? "Finalized" : "In progress"}
        </span>
      </header>

      <section
        className="match-banner"
        aria-label="Match teams and saved scores"
      >
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
            <span className="score-sheet-status">
              {scoreStatuses[alliance] ?? "Not started"}
            </span>
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

      <form className="scoring-form" onSubmit={submit}>
        <div className="alliance-grid">
          {(["red", "blue"] as const).map((alliance) => (
            <fieldset
              className={`alliance-sheet alliance-sheet--${alliance}`}
              disabled={fieldsDisabled}
              key={alliance}
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

        {canEditCorrection && (
          <label className="correction-reason" htmlFor="correction-reason">
            Correction reason
            <textarea
              id="correction-reason"
              maxLength={500}
              minLength={5}
              onChange={(event) => setReason(event.currentTarget.value)}
              required
              value={reason}
            />
          </label>
        )}

        {feedback && (
          <p
            className={`feedback ${feedback.error ? "feedback--error" : "feedback--success"}`}
            role={feedback.error ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        )}

        <div className="form-actions">
          <p>
            {canEditCorrection
              ? "Corrections require a reason and create an audit record."
              : canEditDrafts
                ? "Only draft scores can be edited. Submitted scores are locked."
                : canFinalizeMatch
                  ? "Both score sheets are submitted and ready for finalization."
                  : isFinalized
                    ? "Final scores are locked. Ask a head referee to make a correction."
                    : "Your role can view these scores but cannot change their status."}
          </p>
          <div className="score-actions">
            {canEditDrafts && (
              <>
                <button
                  className="button button--outline"
                  disabled={isSubmitting}
                  type="submit"
                  value="draft"
                >
                  Save draft
                </button>
                <button
                  className="button button--primary"
                  disabled={isSubmitting}
                  type="submit"
                  value="submit"
                >
                  Submit both sheets
                </button>
              </>
            )}
            {canFinalizeMatch && (
              <button
                className="button button--primary"
                disabled={isSubmitting}
                type="submit"
                value="finalize"
              >
                Finalize scores
              </button>
            )}
            {canEditCorrection && (
              <button
                className="button button--primary"
                disabled={isSubmitting}
                type="submit"
                value="correct"
              >
                Save audited correction
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
