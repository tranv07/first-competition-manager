import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { CompetitionRole } from "@fcm/shared";
import { PermissionError, requireCompetitionPermission } from "@/lib/permissions";
import { prisma } from "@fcm/prisma";
import UserAdminPanel, {
  type CompetitionUser,
} from "@/components/UserAdminPanel";

export default async function CompetitionUsersPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  try {
    await requireCompetitionPermission(competitionId, "role.assign");
  } catch (error) {
    if (error instanceof PermissionError && error.status === 401) {
      redirect("/login");
    }
    if (error instanceof PermissionError && error.status === 404) {
      notFound();
    }
    if (error instanceof PermissionError && error.status === 403) {
      return (
        <section className="panel not-found-panel">
          <p className="eyebrow">ACCESS DENIED</p>
          <h1>You cannot manage staff for this competition.</h1>
          <Link className="button button--primary" href="/workspace">
            Return to workspace
          </Link>
        </section>
      );
    }
    throw error;
  }

  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { name: true },
  });
  if (!competition) notFound();

  const assignments = await prisma.competitionRole.findMany({
    where: { competitionId },
    include: {
      user: {
        select: { id: true, name: true, email: true, isActive: true },
      },
    },
    orderBy: [{ user: { name: "asc" } }, { role: "asc" }],
  });
  const usersById = new Map<string, CompetitionUser>();
  for (const assignment of assignments) {
    const user = usersById.get(assignment.userId) ?? {
      ...assignment.user,
      roles: [],
    };
    user.roles.push(assignment.role as CompetitionRole);
    usersById.set(user.id, user);
  }

  return (
    <div className="page-content">
      <header className="content-header">
        <div>
          <p className="eyebrow">ACCESS CONTROL</p>
          <h1>Users and roles</h1>
          <p className="subheading">
            Manage staff access for {competition.name}.
          </p>
        </div>
        <Link className="button button--outline" href="/workspace/events">
          Back to event
        </Link>
      </header>
      <UserAdminPanel
        competitionId={competitionId}
        users={[...usersById.values()]}
      />
    </div>
  );
}
