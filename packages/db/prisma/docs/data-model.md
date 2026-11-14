# FIRST Competition Manager: Data Model

Relational data model (PostgreSQL) for managing alliance-based FIRST competitions (FTC, FRC, FIRST Global, ...).
Scoring phases (Auto, Tele-Op, Endgame, ...) are **optional** and defined per scoring config.

**Conventions**

- `?` after a type means the column is nullable.
- All `id` columns are UUIDs. All timestamps are stored in UTC.
- "Cached" columns are derived data, recalculated by the service layer and never edited by hand.
- Only alliance-based programs are supported: every match has a red and a blue alliance.

---

## Overview

```
User ──< CompetitionRole >── Competition ──< CompetitionTeam >── Team
                                  │
                                  ├──< Match ──< MatchTeam >── Team
                                  │      │
                                  │      └──< MatchScore ──< ScoreEntry >── ScoringElement
                                  │               │                              │
                                  │               └──< ScoreAudit                │
                                  │                                              │
                                  ├──< Ranking >── Team                          │
                                  │                                              │
                                  └── ScoringConfig ──< ScoringPhase ──< ScoringElement
                                          │
                                          └── RankingConfig (1:1)
```

## Enums

| Enum | Values |
|---|---|
| `program` | `ftc`, `frc`, `first_global`, `other` |
| `stage` | `qualification`, `playoff`, `final` |
| `competition_status` | `draft`, `active`, `completed` |
| `match_status` | `upcoming`, `in_progress`, `completed`, `postponed` |
| `score_status` | `draft`, `submitted`, `finalized` |
| `alliance` | `red`, `blue` |
| `competition_role` | `event_admin`, `head_referee`, `scorekeeper` |

---

## Core Tables

### Competition

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | String | Event name |
| `program` | Enum | `program` |
| `start_date` | Date | First day |
| `end_date` | Date | Last day |
| `location` | String? | Venue or city |
| `scoring_config_id` | UUID | FK → ScoringConfig |
| `status` | Enum | `competition_status` |
| `created_at` | Timestamp | Record creation time |

### Team

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `program` | Enum | `program` (team numbers are only unique per program) |
| `team_number` | Integer | Competition number |
| `name` | String | Team name |
| `organization` | String | School, club or sponsor |
| `city` | String? | City/province |
| `coach_name` | String | Lead coach |
| `robot_name` | String? | Robot name |
| `logo_url` | String? | Uploaded team logo |
| `contact_email` | String | Team contact |
| `created_at` | Timestamp | Record creation time |

**Unique:** `(program, team_number)`

### CompetitionTeam

Registration of a team for a competition.

| Field | Type | Description |
|---|---|---|
| `competition_id` | UUID | FK → Competition |
| `team_id` | UUID | FK → Team |
| `registered_at` | Timestamp | Registration time |

**Primary key:** `(competition_id, team_id)`

### Match

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `competition_id` | UUID | FK → Competition |
| `stage` | Enum | `stage` |
| `round` | Integer? | Playoff round (null for qualification) |
| `series` | Integer? | Playoff series or bracket slot (null for qualification) |
| `match_number` | Integer | Match identifier within the stage |
| `scheduled_time` | Timestamp? | Planned start time |
| `field_number` | Integer? | Field assignment |
| `status` | Enum | `match_status` |

**Unique:** `(competition_id, stage, match_number)`

### MatchTeam

Single source of truth for which teams played in a match and on which alliance. Supports any alliance size.

| Field | Type | Description |
|---|---|---|
| `match_id` | UUID | FK → Match |
| `team_id` | UUID | FK → Team |
| `alliance` | Enum | `alliance` (`red` or `blue`) |
| `is_surrogate` | Boolean | Surrogate match: the match doesn't count toward this team's ranking |
| `is_dq` | Boolean | Disqualified or no-show |

**Primary key:** `(match_id, team_id)`

The service layer must verify that the team is registered in `CompetitionTeam` for the match's competition.

---

## Users & Access

### User

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `username` | String | Login username (unique) |
| `email` | String | Email address (unique) |
| `password_hash` | String | Hashed password (Argon2/bcrypt), or managed by the auth library |
| `is_super_admin` | Boolean | Global administrator |
| `is_active` | Boolean | Account active status |
| `created_at` | Timestamp | Record creation time |
| `last_login_at` | Timestamp? | Last successful login |

### CompetitionRole

Per-competition roles. `super_admin` is a global flag on `User`.

| Field | Type | Description |
|---|---|---|
| `user_id` | UUID | FK → User |
| `competition_id` | UUID | FK → Competition |
| `role` | Enum | `competition_role` |

**Primary key:** `(user_id, competition_id, role)`

---

## Scoring Configuration

A `ScoringConfig` is reusable across competitions and seasons. A competition points to one config via `Competition.scoring_config_id`.

### ScoringConfig

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | String | e.g. "FTC Into the Deep" |
| `program` | Enum | `program` |
| `minor_foul_points` | Integer? | Null if fouls don't apply |
| `major_foul_points` | Integer? | Null if fouls don't apply |

Once any score using a config is finalized, the config is **locked**. To change point values, clone the config and assign the clone to the next competition.

### ScoringPhase

Optional per config: zero, one, or many rows.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `config_id` | UUID | FK → ScoringConfig |
| `key` | String | `auto`, `teleop`, `endgame`, `match`, ... |
| `label` | String | Display name |
| `position` | Integer | Order in the UI |

**Unique:** `(config_id, key)`

### ScoringElement

What can be scored within a phase.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `phase_id` | UUID | FK → ScoringPhase |
| `key` | String | e.g. `high_basket` |
| `label` | String | Display name |
| `points` | Integer | Points per unit |
| `max_count` | Integer? | Optional upper bound for validation |

**Unique:** `(phase_id, key)`

### RankingConfig

1:1 with `ScoringConfig`. Lets each program define its own ranking rules without code changes.

| Field | Type | Description |
|---|---|---|
| `scoring_config_id` | UUID | PK and FK → ScoringConfig |
| `win_rp` | Integer | RP for a win (FTC: 2) |
| `tie_rp` | Integer | RP for a tie (FTC: 1) |
| `loss_rp` | Integer | RP for a loss (FTC: 0) |
| `tiebreaker_order` | Text[] | e.g. `{ranking_points, tiebreaker_points, highest_score}` |

---

## Scores

### MatchScore

One score per alliance per match.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `match_id` | UUID | FK → Match |
| `alliance` | Enum | `alliance` (`red` or `blue`) |
| `minor_fouls` | Integer | Default `0` |
| `major_fouls` | Integer | Default `0` |
| `total_score` | Integer | Computed server-side, stored for fast leaderboards |
| `submitted_by` | UUID | FK → User |
| `finalized_by` | UUID? | FK → User (Head Referee) |
| `finalized_at` | Timestamp? | Finalization time |
| `status` | Enum | `score_status` |

**Unique:** `(match_id, alliance)`

The service layer must verify that the match has at least one `MatchTeam` row for the alliance being scored.

### ScoreEntry

One row per scored element.

| Field | Type | Description |
|---|---|---|
| `match_score_id` | UUID | FK → MatchScore |
| `element_id` | UUID | FK → ScoringElement |
| `count` | Integer | How many times it was achieved (`CHECK count >= 0`) |

**Primary key:** `(match_score_id, element_id)`

### ScoreAudit

History of changes to a score, in particular corrections after finalization.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `match_score_id` | UUID | FK → MatchScore |
| `changed_by` | UUID | FK → User |
| `changed_at` | Timestamp | Time of the change |
| `old_value` | JSONB | Snapshot of the score before the change |
| `new_value` | JSONB | Snapshot of the score after the change |
| `reason` | String? | Why the change was made |

---

## Rankings

### Ranking

| Field | Type | Description |
|---|---|---|
| `competition_id` | UUID | FK → Competition |
| `stage` | Enum | `stage` (usually `qualification`) |
| `team_id` | UUID | FK → Team |
| `rank` | Integer | Cached, recalculated (non-unique) |
| `matches_played` | Integer | Cached |
| `wins` | Integer | Cached, default `0` |
| `losses` | Integer | Cached, default `0` |
| `ties` | Integer | Cached, default `0` |
| `ranking_points` | Numeric | Numeric, since some programs use averages |
| `tiebreaker_points` | Numeric | Same |
| `total_points` | Integer | Cached |
| `highest_score` | Integer | Cached |
| `updated_at` | Timestamp | Last recalculation |

**Primary key:** `(competition_id, stage, team_id)`

---

## Business Rules

- **Optional phases:** a competition without Auto/Tele-Op/Endgame simply has no such `ScoringPhase` rows (e.g. FIRST Global may have a single `match` phase).
- **Total score:** `SUM(entry.count * element.points) + fouls * foul_points`, computed in the service layer on submit and stored in `total_score`. Never trust the client.
- **Finalized scores:** once `status = finalized`, `total_score` is frozen. Corrections go through `ScoreAudit`. For stricter history, snapshot `points` into `ScoreEntry`.
- **Rankings:** only matches with a finalized score count. Recalculate the affected teams' rows in a transaction whenever a score is finalized or corrected. Respect `is_surrogate` and `is_dq`. Sort by `RankingConfig.tiebreaker_order`, then assign `rank` with `RANK()` or `DENSE_RANK()`.
- **Integrity:** the service layer verifies that every `ScoreEntry.element_id` belongs to the scoring config of the match's competition, that every `MatchTeam.team_id` is registered via `CompetitionTeam`, and that a `MatchScore` alliance exists in the match.
- **UI:** the scoring form is generated from the competition's phases and elements, so only existing phases are shown. Each match shows a red and a blue score sheet.

## Examples

### FTC (Into the Deep)

| Phase | Element | Points |
|---|---|---|
| `auto` | `net_zone` | 2 |
| `auto` | `parking` | 3 |
| `teleop` | `high_basket` | 8 |
| `endgame` | `ascent_level1` | 3 |
| `endgame` | `ascent_level2` | 15 |
| `endgame` | `ascent_level3` | 30 |

### FIRST Global (single phase)

| Phase | Element | Points |
|---|---|---|
| `match` | `balls_scored` | 1 |