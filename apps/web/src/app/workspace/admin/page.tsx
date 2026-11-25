import { notFound, redirect } from "next/navigation";
import AdminCrudPanel from "@/components/AdminCrudPanel";
import { prisma } from "@fcm/prisma";
import {
  PermissionError,
  requireActiveUser,
  requireCompetitionPermission,
} from "@/lib/permissions";
import { getDemoCompetitionData } from "@/lib/competition-data";

export default async function AdminCrudPage() {
  let user: Awaited<ReturnType<typeof requireActiveUser>>;
  try {
    user = await requireActiveUser();
  } catch (error) {
    if (error instanceof PermissionError && error.status === 401) {
      redirect("/login");
    }
    if (error instanceof PermissionError && error.status === 403) {
      redirect("/login?error=inactive");
    }
    throw error;
  }

  const data = await getDemoCompetitionData();
  if (!data) notFound();
  const competitionId = data.competition.id;

  let canEdit = false;
  let canConfigure = false;
  try {
    await requireCompetitionPermission(competitionId, "competition.edit");
    canEdit = true;
  } catch (error) {
    if (!(error instanceof PermissionError && error.status === 403))
      throw error;
  }
  try {
    await requireCompetitionPermission(competitionId, "config.edit");
    canConfigure = true;
  } catch (error) {
    if (!(error instanceof PermissionError && error.status === 403))
      throw error;
  }
  if (!user.isSuperAdmin && !canEdit && !canConfigure) {
    redirect("/workspace/access-denied");
  }

  const [
    competition,
    competitions,
    scoringConfigs,
    teams,
    registrations,
    scheduleConfig,
  ] = await Promise.all([
    prisma.competition.findUnique({
      where: { id: competitionId },
      select: {
        id: true,
        name: true,
        program: true,
        startDate: true,
        endDate: true,
        location: true,
        status: true,
      },
    }),
    prisma.competition.findMany({
      select: { id: true, name: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.scoringConfig.findMany({
      select: { id: true, name: true, program: true },
      orderBy: [{ program: "asc" }, { name: "asc" }],
    }),
    prisma.team.findMany({
      select: {
        id: true,
        name: true,
        program: true,
        teamNumber: true,
      },
      orderBy: { teamNumber: "asc" },
    }),
    prisma.competitionTeam.findMany({
      where: { competitionId },
      select: { teamId: true },
    }),
    prisma.scheduleConfig.findUnique({
      where: { competitionId },
    }),
  ]);
  if (!competition) notFound();

  return (
    <div className="page-content">
      <header className="content-header">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Competition CRUD</h1>
          <p className="subheading">
            Configure competitions, teams, registrations, matches, and
            schedules.
          </p>
        </div>
      </header>
      <AdminCrudPanel
        competition={competition}
        competitions={competitions}
        scoringConfigs={scoringConfigs}
        teams={teams}
        registeredTeamIds={registrations.map(
          (registration) => registration.teamId,
        )}
        scheduleConfig={scheduleConfig}
        isSuperAdmin={user.isSuperAdmin}
        canEdit={canEdit}
        canConfigure={canConfigure}
      />
    </div>
  );
}
