import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const configName = "FTC Into the Deep";
  let scoringConfig = await prisma.scoringConfig.findFirst({
    where: { program: "ftc", name: configName },
  });

  if (!scoringConfig) {
    scoringConfig = await prisma.scoringConfig.create({
      data: {
        program: "ftc",
        name: configName,
        minorFoulPoints: 5,
        majorFoulPoints: 15,
      },
    });
  } else {
    scoringConfig = await prisma.scoringConfig.update({
      where: { id: scoringConfig.id },
      data: { minorFoulPoints: 5, majorFoulPoints: 15 },
    });
  }

  await prisma.rankingConfig.upsert({
    where: { scoringConfigId: scoringConfig.id },
    create: {
      scoringConfigId: scoringConfig.id,
      winRp: 2,
      tieRp: 1,
      lossRp: 0,
      tiebreakerOrder: ["ranking_points", "tiebreaker_points", "highest_score"],
    },
    update: {
      winRp: 2,
      tieRp: 1,
      lossRp: 0,
      tiebreakerOrder: ["ranking_points", "tiebreaker_points", "highest_score"],
    },
  });

  const scoringPhases = [
    {
      key: "auto",
      label: "Autonomous",
      position: 0,
      elements: [
        { key: "net_zone", label: "Net Zone", points: 2, maxCount: null },
        { key: "parking", label: "Parking", points: 3, maxCount: null },
      ],
    },
    {
      key: "teleop",
      label: "Tele-Op",
      position: 1,
      elements: [
        { key: "high_basket", label: "High Basket", points: 8, maxCount: null },
      ],
    },
    {
      key: "endgame",
      label: "Endgame",
      position: 2,
      elements: [
        { key: "ascent_level1", label: "Level 1 Ascent", points: 3, maxCount: 1 },
        { key: "ascent_level2", label: "Level 2 Ascent", points: 15, maxCount: 1 },
        { key: "ascent_level3", label: "Level 3 Ascent", points: 30, maxCount: 1 },
      ],
    },
  ];

  for (const phaseData of scoringPhases) {
    const phase = await prisma.scoringPhase.upsert({
      where: {
        config_phase_key: { configId: scoringConfig.id, key: phaseData.key },
      },
      create: {
        configId: scoringConfig.id,
        key: phaseData.key,
        label: phaseData.label,
        position: phaseData.position,
      },
      update: { label: phaseData.label, position: phaseData.position },
    });

    for (const elementData of phaseData.elements) {
      await prisma.scoringElement.upsert({
        where: {
          phase_element_key: { phaseId: phase.id, key: elementData.key },
        },
        create: { phaseId: phase.id, ...elementData },
        update: {
          label: elementData.label,
          points: elementData.points,
          maxCount: elementData.maxCount,
        },
      });
    }
  }

  const teamData = [
    {
      teamNumber: 10001,
      name: "Test Bots",
      organization: "FCM Demo School",
      city: "Ottawa",
      coachName: "Alex Coach",
      contactEmail: "team10001@example.test",
      robotName: "Prototype",
    },
    {
      teamNumber: 10002,
      name: "Circuit Breakers",
      organization: "FCM Demo Club",
      city: "Toronto",
      coachName: "Taylor Coach",
      contactEmail: "team10002@example.test",
      robotName: "Breaker",
    },
    {
      teamNumber: 10003,
      name: "Gear Grinders",
      organization: "FCM Demo School",
      city: "Montreal",
      coachName: "Jordan Coach",
      contactEmail: "team10003@example.test",
      robotName: "Gearbox",
    },
  ];

  const teams = [];
  for (const teamDataItem of teamData) {
    teams.push(
      await prisma.team.upsert({
        where: {
          program_team_number: {
            program: "ftc",
            teamNumber: teamDataItem.teamNumber,
          },
        },
        create: { program: "ftc", ...teamDataItem },
        update: teamDataItem,
      }),
    );
  }

  const competitionName = "FTC Test Invitational";
  let competition = await prisma.competition.findFirst({
    where: { name: competitionName, program: "ftc" },
  });

  const competitionData = {
    name: competitionName,
    program: "ftc" as const,
    startDate: new Date("2025-02-15T00:00:00.000Z"),
    endDate: new Date("2025-02-15T00:00:00.000Z"),
    location: "FCM Demo Venue",
    scoringConfigId: scoringConfig.id,
    status: "draft" as const,
  };

  if (!competition) {
    competition = await prisma.competition.create({ data: competitionData });
  } else {
    competition = await prisma.competition.update({
      where: { id: competition.id },
      data: competitionData,
    });
  }

  for (const team of teams) {
    await prisma.competitionTeam.upsert({
      where: {
        competitionId_teamId: { competitionId: competition.id, teamId: team.id },
      },
      create: { competitionId: competition.id, teamId: team.id },
      update: {},
    });
  }

  console.log(
    `Seeded ${scoringConfig.name}, ${teams.length} FTC teams, and ${competition.name}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
