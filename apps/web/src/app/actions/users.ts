"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@fcm/prisma";
import { auth } from "@/lib/auth";
import {
  PermissionError,
  requireCompetitionPermission,
} from "@/lib/permissions";

export interface UserActionState {
  message: string;
  error?: boolean;
}

const roleSchema = z.enum(["event_admin", "head_referee", "scorekeeper"]);

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formRawString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateUsersPage(competitionId: string) {
  revalidatePath(`/workspace/events/${competitionId}/users`);
}

export async function createOrAssignUser(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const competitionId = formString(formData, "competitionId");
  try {
    await requireCompetitionPermission(competitionId, "role.assign");
  } catch (error) {
    if (error instanceof PermissionError) {
      return { message: error.message, error: true };
    }
    throw error;
  }

  const email = formString(formData, "email").toLowerCase();
  const name = formString(formData, "name");
  const password = formRawString(formData, "password");
  const role = roleSchema.safeParse(formString(formData, "role"));
  if (!z.email().safeParse(email).success || !role.success) {
    return { message: "Enter a valid email address and role.", error: true };
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    if (!name || password.length < 12 || password.length > 128) {
      return {
        message:
          "For a new account, provide a name and a password between 12 and 128 characters.",
        error: true,
      };
    }
    await auth.api.createUser({
      body: { email, password, name },
    });
    user = await prisma.user.findUniqueOrThrow({ where: { email } });
  } else if (!user.isActive) {
    return {
      message:
        "This account is inactive. Reactivate it before assigning roles.",
      error: true,
    };
  }

  await prisma.competitionRole.upsert({
    where: {
      userId_competitionId_role: {
        userId: user.id,
        competitionId,
        role: role.data,
      },
    },
    create: { userId: user.id, competitionId, role: role.data },
    update: {},
  });
  revalidateUsersPage(competitionId);
  return {
    message: `Access assigned to ${user.name} for this competition.`,
  };
}

export async function assignCompetitionRole(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const competitionId = formString(formData, "competitionId");
  try {
    await requireCompetitionPermission(competitionId, "role.assign");
  } catch (error) {
    if (error instanceof PermissionError) {
      return { message: error.message, error: true };
    }
    throw error;
  }

  const userId = formString(formData, "userId");
  const parsedRole = roleSchema.safeParse(formString(formData, "role"));
  const mode = formString(formData, "mode");
  if (!parsedRole.success || !userId || !["add", "remove"].includes(mode)) {
    return { message: "Choose a user, role, and valid change.", error: true };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });
  if (!user) return { message: "User not found.", error: true };
  if (mode === "add" && !user.isActive) {
    return {
      message: "Reactivate this account before assigning a role.",
      error: true,
    };
  }

  if (mode === "add") {
    await prisma.competitionRole.upsert({
      where: {
        userId_competitionId_role: {
          userId,
          competitionId,
          role: parsedRole.data,
        },
      },
      create: {
        userId,
        competitionId,
        role: parsedRole.data,
      },
      update: {},
    });
  } else {
    await prisma.competitionRole.deleteMany({
      where: { userId, competitionId, role: parsedRole.data },
    });
  }
  revalidateUsersPage(competitionId);
  return { message: mode === "add" ? "Role added." : "Role removed." };
}

export async function setUserActive(
  _previousState: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const competitionId = formString(formData, "competitionId");
  let actor;
  try {
    ({ user: actor } = await requireCompetitionPermission(
      competitionId,
      "role.assign",
    ));
  } catch (error) {
    if (error instanceof PermissionError) {
      return { message: error.message, error: true };
    }
    throw error;
  }

  const userId = formString(formData, "userId");
  const activeValue = formString(formData, "active");
  if (activeValue !== "true" && activeValue !== "false") {
    return {
      message: "Choose whether to activate or deactivate this account.",
      error: true,
    };
  }
  const active = activeValue === "true";
  if (!userId || userId === actor.id) {
    return {
      message: "You cannot change your own account status here.",
      error: true,
    };
  }
  const membership = await prisma.competitionRole.findFirst({
    where: { userId, competitionId },
    select: { user: { select: { isSuperAdmin: true } } },
  });
  if (!membership)
    return { message: "Competition user not found.", error: true };
  if (membership.user.isSuperAdmin && !actor.isSuperAdmin) {
    return {
      message: "Only a super admin can change another super admin's status.",
      error: true,
    };
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: { isActive: active },
    });
    if (!active) {
      await transaction.session.deleteMany({ where: { userId } });
    }
  });
  revalidateUsersPage(competitionId);
  return {
    message: active
      ? "Account reactivated. The user must sign in again."
      : "Account deactivated and active sessions ended.",
  };
}
