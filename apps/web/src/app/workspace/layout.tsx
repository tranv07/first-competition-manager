import type { ReactNode } from "react";
import type { CompetitionRole } from "@fcm/shared";
import { redirect } from "next/navigation";
import { AppFrame } from "@/App";
import { getDemoCompetitionData } from "@/lib/competition-data";
import { prisma } from "@fcm/prisma";
import { PermissionError, requireActiveUser } from "@/lib/permissions";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
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
  if (!data) {
    return (
      <main className="error-page">
        <section className="panel setup-message">
          <h1>Competition workspace is not ready.</h1>
          <p>Seed the database, then reload this page.</p>
        </section>
      </main>
    );
  }
  const assignedRoles = await prisma.competitionRole.findMany({
    where: { userId: user.id, competitionId: data.competition.id },
    select: { role: true },
  });
  const roles = assignedRoles.flatMap(({ role }) =>
    role === "event_admin" || role === "head_referee" || role === "scorekeeper"
      ? [role as CompetitionRole]
      : [],
  );

  return (
    <AppFrame
      canManageUsers={user.isSuperAdmin || roles.includes("event_admin")}
      canAdmin={user.isSuperAdmin || roles.includes("event_admin")}
      currentUser={{ name: user.name, email: user.email }}
      data={data}
    >
      {children}
    </AppFrame>
  );
}
