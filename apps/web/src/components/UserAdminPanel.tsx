"use client";

import { useActionState } from "react";
import {
  assignCompetitionRole,
  createOrAssignUser,
  setUserActive,
  type UserActionState,
} from "@/app/actions/users";
import type { CompetitionRole } from "@fcm/shared";

const roles: { value: CompetitionRole; label: string }[] = [
  { value: "event_admin", label: "Event admin" },
  { value: "head_referee", label: "Head referee" },
  { value: "scorekeeper", label: "Scorekeeper" },
];

const initialState: UserActionState = { message: "" };

export interface CompetitionUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roles: CompetitionRole[];
}

function Feedback({ state }: { state: UserActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={`feedback ${state.error ? "feedback--error" : "feedback--success"}`}
      role={state.error ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

function UserRoleCard({
  competitionId,
  user,
}: {
  competitionId: string;
  user: CompetitionUser;
}) {
  const [roleState, roleAction, isChangingRole] = useActionState(
    assignCompetitionRole,
    initialState,
  );
  const [statusState, statusAction, isChangingStatus] = useActionState(
    setUserActive,
    initialState,
  );
  const availableRoles = roles.filter((role) => !user.roles.includes(role.value));

  return (
    <article className="competition-user-card">
      <div className="competition-user-heading">
        <div>
          <h3>{user.name}</h3>
          <p>{user.email}</p>
        </div>
        <span
          className={`status-pill status-pill--${user.isActive ? "complete" : "upcoming"}`}
        >
          {user.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="user-role-list">
        {user.roles.map((role) => (
          <span className="count-badge" key={role}>
            {roles.find((item) => item.value === role)?.label ?? role}
          </span>
        ))}
      </div>
      <div className="user-admin-controls">
        {availableRoles.length > 0 && user.isActive && (
          <form action={roleAction} className="inline-role-form">
            <input name="competitionId" type="hidden" value={competitionId} />
            <input name="userId" type="hidden" value={user.id} />
            <input name="mode" type="hidden" value="add" />
            <label className="visually-hidden" htmlFor={`role-${user.id}`}>
              Add a competition role
            </label>
            <select id={`role-${user.id}`} name="role" required>
              {availableRoles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <button className="button button--outline" disabled={isChangingRole}>
              {isChangingRole ? "Saving..." : "Add role"}
            </button>
          </form>
        )}
        {user.roles.map((role) => (
          <form action={roleAction} key={`${user.id}-${role}`}>
            <input name="competitionId" type="hidden" value={competitionId} />
            <input name="userId" type="hidden" value={user.id} />
            <input name="role" type="hidden" value={role} />
            <input name="mode" type="hidden" value="remove" />
            <button
              className="button button--text"
              disabled={isChangingRole}
            >
              Remove {roles.find((item) => item.value === role)?.label}
            </button>
          </form>
        ))}
        <form action={statusAction}>
          <input name="competitionId" type="hidden" value={competitionId} />
          <input name="userId" type="hidden" value={user.id} />
          <input
            name="active"
            type="hidden"
            value={user.isActive ? "false" : "true"}
          />
          <button
            className="button button--text"
            disabled={isChangingStatus}
          >
            {user.isActive ? "Deactivate account" : "Reactivate account"}
          </button>
        </form>
      </div>
      <Feedback state={roleState} />
      <Feedback state={statusState} />
    </article>
  );
}

export default function UserAdminPanel({
  competitionId,
  users,
}: {
  competitionId: string;
  users: CompetitionUser[];
}) {
  const [createState, createAction, isCreating] = useActionState(
    createOrAssignUser,
    initialState,
  );

  return (
    <div className="user-admin-layout">
      <section className="panel user-create-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">ACCOUNT ACCESS</p>
            <h2>Create account or assign role</h2>
          </div>
        </div>
        <p>
          Existing accounts receive the selected role. New accounts require a
          password that is at least 12 characters.
        </p>
        <form action={createAction} className="user-create-form">
          <input name="competitionId" type="hidden" value={competitionId} />
          <label htmlFor="user-name">Name</label>
          <input autoComplete="name" id="user-name" name="name" />
          <label htmlFor="user-email">Email address</label>
          <input
            autoComplete="email"
            id="user-email"
            name="email"
            required
            type="email"
          />
          <label htmlFor="user-password">Temporary password</label>
          <input
            autoComplete="new-password"
            id="user-password"
            maxLength={128}
            minLength={12}
            name="password"
            type="password"
          />
          <label htmlFor="user-role">Competition role</label>
          <select id="user-role" name="role" required>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <button className="button button--primary" disabled={isCreating}>
            {isCreating ? "Saving..." : "Create or assign access"}
          </button>
        </form>
        <Feedback state={createState} />
      </section>

      <section className="panel user-list-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">COMPETITION STAFF</p>
            <h2>Assigned accounts</h2>
          </div>
          <span className="count-badge">{users.length} accounts</span>
        </div>
        {users.length > 0 ? (
          <div className="competition-user-list">
            {users.map((user) => (
              <UserRoleCard
                competitionId={competitionId}
                key={user.id}
                user={user}
              />
            ))}
          </div>
        ) : (
          <p className="empty-panel">
            No staff accounts have been assigned to this competition.
          </p>
        )}
      </section>
    </div>
  );
}
