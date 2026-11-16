# FIRST Competition Manager: Data Model

Relational data model (PostgreSQL) for managing alliance-based FIRST competitions (FTC, FRC, FIRST Global, ...).
Scoring phases (Auto, Tele-Op, Endgame, ...) are defined per scoring config; a format without distinct phases uses a single one.

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
                                  ├── ScheduleConfig (1:1) ──< ScheduleBreak
                                  │
                                  ├──< PlayoffAlliance ──< PlayoffAllianceTeam >── Team
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
| `ranking_criterion` | `ranking_points`, `tiebreaker_points`, `total_points`, `highest_score` |
| `tiebreaker_points_rule` | `none`, `own_score`, `own_score_without_fouls`, `losing_alliance_score` |
| `ranking_aggregation` | `sum`, `average` |
| `playoff_role` | `captain`, `pick`, `backup` |

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

The service layer must verify that the team is registered in `CompetitionTeam` for the match's competition, and that each alliance has `ScoringConfig.teams_per_alliance` teams.

---

## Schedule

### ScheduleConfig

Parameters for the qualification schedule. 1:1 with `Competition`. Used by the schedule generator and by schedule validation.

| Field | Type | Description |
|---|---|---|
| `competition_id` | UUID | PK and FK → Competition |
| `matches_per_team` | Integer | Qualification matches each team plays |
| `number_of_fields` | Integer | Fields running in parallel |
| `cycle_time_minutes` | Integer | Time between match starts on one field |
| `start_time` | Timestamp | Start of the first match |
| `min_matches_between` | Integer | Minimum matches between two plays of the same team |
| `random_seed` | Integer? | Seed for reproducible schedule generation |

### ScheduleBreak

Breaks (lunch, field reset, ceremonies) the generator must skip.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `competition_id` | UUID | FK → Competition |
| `start_time` | Timestamp | Break start |
| `end_time` | Timestamp | Break end |
| `label` | String? | e.g. "Lunch" |

---

## Playoffs

### PlayoffAlliance

An alliance formed during alliance selection.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `competition_id` | UUID | FK → Competition |
| `seed` | Integer | Alliance number / seed (1 = top seed) |

**Unique:** `(competition_id, seed)`

### PlayoffAllianceTeam

Result of alliance selection: which team belongs to which alliance and in what role.

| Field | Type | Description |
|---|---|---|
| `alliance_id` | UUID | FK → PlayoffAlliance |
| `competition_id` | UUID | FK → Competition (denormalized for the uniqueness rule) |
| `team_id` | UUID | FK → Team |
| `role` | Enum | `playoff_role` (`captain`, `pick`, `backup`) |
| `pick_order` | Integer? | Overall order in which the team was picked (null for captains) |

**Primary key:** `(alliance_id, team_id)`
**Unique:** `(competition_id, team_id)`, so a team belongs to at most one alliance per competition.

A playoff match links to its alliances through `MatchTeam`: the team's `PlayoffAllianceTeam` row gives the alliance. Series winners and bracket advancement are derived from the matches that share `(competition_id, round, series)`.

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
| `teams_per_alliance` | Integer | Teams on each alliance (FTC: 2, FRC: 3) |
| `minor_foul_points` | Integer | Points awarded to the **opponent** per minor foul, default `0` |
| `major_foul_points` | Integer | Points awarded to the **opponent** per major foul, default `0` |

A value of `0` means fouls don't give points. Once any score using a config is finalized, the config is **locked**. To change point values, clone the config and assign the clone to the next competition.

### ScoringPhase

One or more per config. A format without distinct phases uses a single phase such as `match`.

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

1:1 with `ScoringConfig`. Lets each program define its own ranking rules without code changes. The exact rules differ by program and season, so check the current game manual when creating a config.

| Field | Type | Description |
|---|---|---|
| `scoring_config_id` | UUID | PK and FK → ScoringConfig |
| `win_rp` | Integer | RP for a win (FTC: 2) |
| `tie_rp` | Integer | RP for a tie (FTC: 1) |
| `loss_rp` | Integer | RP for a loss (FTC: 0) |
| `tiebreaker_points_rule` | Enum | `tiebreaker_points_rule`: how TBP is calculated per match |
| `aggregation` | Enum | `ranking_aggregation`: `sum` or `average` of RP and TBP over the counted matches |
| `tiebreaker_order` | Enum[] | `ranking_criterion[]`, ordered, e.g. `{ranking_points, tiebreaker_points, highest_score}` |

**`tiebreaker_points_rule` values**

| Value | TBP per match |
|---|---|
| `none` | No TBP (always 0) |
| `own_score` | The alliance's own total score |
| `own_score_without_fouls` | The alliance's own total score minus the foul points it received |
| `losing_alliance_score` | The score of the losing alliance, given to both alliances (for a tie, the common score) |

---

## Scores

### MatchScore

One score per alliance per match.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `match_id` | UUID | FK → Match |
| `alliance` | Enum | `alliance` (`red` or `blue`) |
| `minor_fouls` | Integer | Minor fouls **committed by this alliance**, default `0` |
| `major_fouls` | Integer | Major fouls **committed by this alliance**, default `0` |
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
| `ranking_points` | Numeric | Sum or average according to `RankingConfig.aggregation` |
| `tiebreaker_points` | Numeric | Sum or average according to `RankingConfig.aggregation` |
| `total_points` | Integer | Cached |
| `highest_score` | Integer | Cached |
| `updated_at` | Timestamp | Last recalculation |

**Primary key:** `(competition_id, stage, team_id)`

---

## Business Rules

- **Total score of an alliance:** `SUM(own entry.count * element.points) + opponent.minor_fouls * minor_foul_points + opponent.major_fouls * major_foul_points`. Fouls committed by an alliance give points to the **opposing** alliance, so the total reads the other alliance's `MatchScore`. Computed in the service layer on submit and stored in `total_score`. Never trust the client.
- **Match result:** win, loss or tie from comparing the two alliance totals. A result exists only when **both** alliance scores are finalized.
- **Finalized scores:** once `status = finalized`, `total_score` is frozen. Corrections go through `ScoreAudit`, and both alliances' totals are recalculated because fouls cross over. For stricter history, snapshot `points` into `ScoreEntry`.
- **Rankings:**
  - Only matches with both alliance scores finalized count; surrogate matches don't count for the surrogate team.
  - A DQ'd team gets 0 RP for that match.
  - RP comes from `win_rp`, `tie_rp`, `loss_rp`. TBP follows `tiebreaker_points_rule`.
  - RP and TBP are summed or averaged according to `aggregation`.
  - Sort by `tiebreaker_order`, then assign `rank` with `RANK()` or `DENSE_RANK()`.
  - Recompute the affected teams in a transaction whenever a score is finalized or corrected.
- **Schedule:** every team plays `matches_per_team` matches, every alliance has `teams_per_alliance` teams, no team is in two matches at the same time, and a team's plays are at least `min_matches_between` apart. Surrogates are added when the number of teams doesn't divide evenly.
- **Playoffs:** a team is in at most one `PlayoffAlliance` per competition. Series results and bracket advancement are derived from the matches in the same `(round, series)`.
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