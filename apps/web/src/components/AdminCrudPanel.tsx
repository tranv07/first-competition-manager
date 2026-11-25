"use client";

import { useActionState } from "react";
import {
  assignScoringConfig,
  createCompetition,
  createTeam,
  registerTeam,
  unregisterTeam,
  updateCompetition,
  updateScheduleConfig,
  validateScheduleAction,
  type AdminActionState,
} from "@/app/actions/admin";

interface Option {
  id: string;
  name: string;
  program?: string;
}

interface TeamOption extends Option {
  teamNumber: number;
}

interface AdminCrudPanelProps {
  competition: {
    id: string;
    name: string;
    program: string;
    startDate: Date;
    endDate: Date;
    location: string | null;
    status: "draft" | "active" | "completed";
  };
  competitions: Array<{ id: string; name: string }>;
  scoringConfigs: Option[];
  teams: TeamOption[];
  registeredTeamIds: string[];
  scheduleConfig: {
    matchesPerTeam: number;
    numberOfFields: number;
    cycleTimeMinutes: number;
    startTime: Date;
    minMatchesBetween: number;
    randomSeed: number | null;
  } | null;
  isSuperAdmin: boolean;
  canEdit: boolean;
  canConfigure: boolean;
}

const initialState: AdminActionState = { message: "" };

export default function AdminCrudPanel({
  competition,
  competitions,
  scoringConfigs,
  teams,
  registeredTeamIds,
  scheduleConfig,
  isSuperAdmin,
  canEdit,
  canConfigure,
}: AdminCrudPanelProps) {
  const [competitionState, competitionAction] = useActionState(
    updateCompetition.bind(null, competition.id),
    initialState,
  );
  const [configState, configAction] = useActionState(
    assignScoringConfig.bind(null, competition.id),
    initialState,
  );
  const [teamState, teamAction] = useActionState(createTeam, initialState);
  const [scheduleState, scheduleAction] = useActionState(
    updateScheduleConfig.bind(null, competition.id),
    initialState,
  );
  const [createCompetitionState, createCompetitionAction] = useActionState(
    createCompetition,
    initialState,
  );

  const availableTeams = teams.filter(
    (team) =>
      team.program === competition.program &&
      !registeredTeamIds.includes(team.id),
  );

  return (
    <div className="admin-grid">
      {createCompetitionState.message && (
        <p
          className={`form-feedback${createCompetitionState.error ? " form-feedback--error" : ""}`}
          role="status"
        >
          {createCompetitionState.message}
        </p>
      )}
      {isSuperAdmin && (
        <section className="panel admin-section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">SUPER ADMIN</p>
              <h2>Create competition</h2>
            </div>
          </div>
          <form action={createCompetitionAction} className="admin-form">
            <label>
              Name
              <input name="name" required maxLength={160} />
            </label>
            <label>
              Program
              <select name="program" defaultValue={competition.program}>
                <option value="ftc">FTC</option>
                <option value="frc">FRC</option>
                <option value="first_global">FIRST Global</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Start date
              <input name="startDate" type="date" required />
            </label>
            <label>
              End date
              <input name="endDate" type="date" required />
            </label>
            <label>
              Location
              <input name="location" maxLength={160} />
            </label>
            <label>
              Scoring config
              <select name="scoringConfigId" required>
                {scoringConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button--primary" type="submit">
              Create competition
            </button>
          </form>
        </section>
      )}

      {canEdit && (
        <section className="panel admin-section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">COMPETITION</p>
              <h2>Edit details and status</h2>
            </div>
          </div>
          {competitionState.message && (
            <p
              className={`form-feedback${competitionState.error ? " form-feedback--error" : ""}`}
              role="status"
            >
              {competitionState.message}
            </p>
          )}
          <form action={competitionAction} className="admin-form">
            <label>
              Name
              <input name="name" defaultValue={competition.name} required />
            </label>
            <label>
              Start date
              <input
                name="startDate"
                type="date"
                defaultValue={competition.startDate.toISOString().slice(0, 10)}
                required
              />
            </label>
            <label>
              End date
              <input
                name="endDate"
                type="date"
                defaultValue={competition.endDate.toISOString().slice(0, 10)}
                required
              />
            </label>
            <label>
              Location
              <input
                name="location"
                defaultValue={competition.location ?? ""}
              />
            </label>
            <label>
              Status
              <select name="status" defaultValue={competition.status}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <button className="button button--primary" type="submit">
              Save competition
            </button>
          </form>
        </section>
      )}

      {canConfigure && (
        <>
          <section className="panel admin-section">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">SCORING</p>
                <h2>Scoring config</h2>
              </div>
            </div>
            {configState.message && (
              <p
                className={`form-feedback${configState.error ? " form-feedback--error" : ""}`}
                role="status"
              >
                {configState.message}
              </p>
            )}
            <form action={configAction} className="admin-form">
              <label>
                Assigned config
                <select name="scoringConfigId" required>
                  {scoringConfigs
                    .filter((config) => config.program === competition.program)
                    .map((config) => (
                      <option key={config.id} value={config.id}>
                        {config.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="button button--primary" type="submit">
                Assign config
              </button>
            </form>
          </section>

          <section className="panel admin-section">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">SCHEDULE</p>
                <h2>Schedule config</h2>
              </div>
            </div>
            {scheduleState.message && (
              <p
                className={`form-feedback${scheduleState.error ? " form-feedback--error" : ""}`}
                role="status"
              >
                {scheduleState.message}
              </p>
            )}
            <form action={scheduleAction} className="admin-form">
              <label>
                Matches per team
                <input
                  name="matchesPerTeam"
                  type="number"
                  min="1"
                  defaultValue={scheduleConfig?.matchesPerTeam ?? 12}
                  required
                />
              </label>
              <label>
                Number of fields
                <input
                  name="numberOfFields"
                  type="number"
                  min="1"
                  defaultValue={scheduleConfig?.numberOfFields ?? 1}
                  required
                />
              </label>
              <label>
                Cycle time (minutes)
                <input
                  name="cycleTimeMinutes"
                  type="number"
                  min="1"
                  defaultValue={scheduleConfig?.cycleTimeMinutes ?? 10}
                  required
                />
              </label>
              <label>
                Start time
                <input
                  name="startTime"
                  type="datetime-local"
                  defaultValue={
                    scheduleConfig
                      ? scheduleConfig.startTime.toISOString().slice(0, 16)
                      : ""
                  }
                  required
                />
              </label>
              <label>
                Minimum matches between
                <input
                  name="minMatchesBetween"
                  type="number"
                  min="0"
                  defaultValue={scheduleConfig?.minMatchesBetween ?? 2}
                  required
                />
              </label>
              <label>
                Random seed
                <input
                  name="randomSeed"
                  type="number"
                  defaultValue={scheduleConfig?.randomSeed ?? ""}
                />
              </label>
              <button className="button button--primary" type="submit">
                Save schedule config
              </button>
            </form>
          </section>
        </>
      )}

      {isSuperAdmin && (
        <section className="panel admin-section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TEAMS</p>
              <h2>Create team</h2>
            </div>
          </div>
          {teamState.message && (
            <p
              className={`form-feedback${teamState.error ? " form-feedback--error" : ""}`}
              role="status"
            >
              {teamState.message}
            </p>
          )}
          <form action={teamAction} className="admin-form">
            <label>
              Program
              <select name="program" defaultValue={competition.program}>
                <option value="ftc">FTC</option>
                <option value="frc">FRC</option>
                <option value="first_global">FIRST Global</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Team number
              <input name="teamNumber" type="number" min="1" required />
            </label>
            <label>
              Team name
              <input name="name" required />
            </label>
            <label>
              Organization
              <input name="organization" required />
            </label>
            <label>
              Coach name
              <input name="coachName" required />
            </label>
            <label>
              Contact email
              <input name="contactEmail" type="email" required />
            </label>
            <label>
              City
              <input name="city" />
            </label>
            <label>
              Robot name
              <input name="robotName" />
            </label>
            <button className="button button--primary" type="submit">
              Create team
            </button>
          </form>
        </section>
      )}

      {canEdit && (
        <section className="panel admin-section">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">REGISTRATION</p>
              <h2>Competition teams</h2>
            </div>
          </div>
          {availableTeams.length === 0 ? (
            <p className="muted-copy">
              No unregistered matching teams are available.
            </p>
          ) : (
            <div className="admin-list">
              {availableTeams.map((team) => (
                <form
                  action={async () => {
                    await registerTeam(competition.id, team.id);
                  }}
                  className="admin-list-row"
                  key={team.id}
                >
                  <span>
                    {team.teamNumber} {team.name}
                  </span>
                  <button className="button button--outline" type="submit">
                    Register
                  </button>
                </form>
              ))}
            </div>
          )}
          {teams
            .filter((team) => registeredTeamIds.includes(team.id))
            .map((team) => (
              <form
                action={async () => {
                  await unregisterTeam(competition.id, team.id);
                }}
                className="admin-list-row"
                key={team.id}
              >
                <span>
                  {team.teamNumber} {team.name}
                </span>
                <button className="button button--danger" type="submit">
                  Unregister
                </button>
              </form>
            ))}
        </section>
      )}

      <section className="panel admin-section">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">SCHEDULE CHECK</p>
            <h2>Validation</h2>
          </div>
        </div>
        <ScheduleValidation competitionId={competition.id} />
      </section>

      <input type="hidden" value={competitions.length} readOnly />
    </div>
  );
}

function ScheduleValidation({ competitionId }: { competitionId: string }) {
  const [state, action] = useActionState(
    validateScheduleAction.bind(null, competitionId),
    initialState,
  );
  return (
    <>
      {state.message && (
        <p
          className={`form-feedback${state.error ? " form-feedback--error" : ""}`}
          role="status"
        >
          {state.message}
        </p>
      )}
      {state.warnings && (
        <ul className="warning-list">
          {state.warnings.map((warning, index) => (
            <li key={`${warning.code}-${index}`}>{warning.message}</li>
          ))}
        </ul>
      )}
      <form action={action}>
        <button className="button button--outline" type="submit">
          Validate schedule
        </button>
      </form>
    </>
  );
}
