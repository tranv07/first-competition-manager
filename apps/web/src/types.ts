export type Alliance = "red" | "blue";

export interface ScoringElement {
  id: string;
  key: string;
  label: string;
  points: number;
  maxCount: number | null;
}

export interface RankingRow {
  teamId?: string;
  teamNumber: number;
  teamName: string;
  rank: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  rankingPoints: number;
  tiebreakerPoints: number;
  totalPoints: number;
  highestScore: number;
}

export interface DemoData {
  competition: {
    id: string;
    name: string;
    location: string | null;
    startDate: string;
    endDate: string;
    status: string;
    scoringConfig: {
      minorFoulPoints: number;
      majorFoulPoints: number;
      phases: Array<{
        id: string;
        key: string;
        label: string;
        elements: ScoringElement[];
      }>;
    };
    registeredTeams: Array<{ id: string; number: number; name: string }>;
  };
  match: {
    id: string;
    number: number;
    status: string;
    scheduledTime: string | null;
    teams: Array<{
      id: string;
      number: number;
      name: string;
      alliance: Alliance;
      isSurrogate: boolean;
      isDq: boolean;
    }>;
    scores: Array<{
      alliance: Alliance;
      status: string;
      minorFouls: number;
      majorFouls: number;
      totalScore: number;
      entries: Array<{ elementId: string; count: number }>;
    }>;
  };
  rankings: RankingRow[];
}

export interface ScoreSheetState {
  minorFouls: string;
  majorFouls: string;
  entries: Record<string, string>;
}

export type ScoreSheets = Record<Alliance, ScoreSheetState>;
