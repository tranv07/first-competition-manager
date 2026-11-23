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
        teamsPerAlliance: 2,
        minorFoulPoints: 5,
        majorFoulPoints: 15,
      },
    });
  } else {
    scoringConfig = await prisma.scoringConfig.update({
      where: { id: scoringConfig.id },
      data: {
        teamsPerAlliance: 2,
        minorFoulPoints: 5,
        majorFoulPoints: 15,
      },
    });
  }

  await prisma.rankingConfig.upsert({
    where: { scoringConfigId: scoringConfig.id },
    create: {
      scoringConfigId: scoringConfig.id,
      winRp: 2,
      tieRp: 1,
      lossRp: 0,
      tiebreakerPointsRule: "own_score",
      aggregation: "sum",
      tiebreakerOrder: ["ranking_points", "tiebreaker_points", "highest_score"],
    },
    update: {
      winRp: 2,
      tieRp: 1,
      lossRp: 0,
      tiebreakerPointsRule: "own_score",
      aggregation: "sum",
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
        {
          key: "ascent_level1",
          label: "Level 1 Ascent",
          points: 3,
          maxCount: 1,
        },
        {
          key: "ascent_level2",
          label: "Level 2 Ascent",
          points: 15,
          maxCount: 1,
        },
        {
          key: "ascent_level3",
          label: "Level 3 Ascent",
          points: 30,
          maxCount: 1,
        },
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
    {
      teamNumber: 10004,
      name: "Robo Raptors",
      organization: "FCM Demo Academy",
      city: "Calgary",
      coachName: "Casey Coach",
      contactEmail: "team10004@example.test",
      robotName: "Raptor",
    },
    {
      teamNumber: 10005,
      name: "Byte-Sized Bots",
      organization: "FCM Demo Club",
      city: "Vancouver",
      coachName: "Morgan Coach",
      contactEmail: "team10005@example.test",
      robotName: "Bit",
    },
    {
      teamNumber: 10006,
      name: "Torque Titans",
      organization: "FCM Demo School",
      city: "Edmonton",
      coachName: "Riley Coach",
      contactEmail: "team10006@example.test",
      robotName: "Titan",
    },
    {
      teamNumber: 10007,
      name: "Pixel Pioneers",
      organization: "FCM Demo Academy",
      city: "Winnipeg",
      coachName: "Avery Coach",
      contactEmail: "team10007@example.test",
      robotName: "Pixel",
    },
    {
      teamNumber: 10008,
      name: "Nova Mechanics",
      organization: "FCM Demo Club",
      city: "Halifax",
      coachName: "Jamie Coach",
      contactEmail: "team10008@example.test",
      robotName: "Nova",
    },
    {
      teamNumber: 10009,
      name: "Copper Circuits",
      organization: "FCM Demo School",
      city: "Quebec City",
      coachName: "Drew Coach",
      contactEmail: "team10009@example.test",
      robotName: "Copper",
    },
    {
      teamNumber: 10010,
      name: "Orbit Engineers",
      organization: "FCM Demo Academy",
      city: "Victoria",
      coachName: "Quinn Coach",
      contactEmail: "team10010@example.test",
      robotName: "Orbit",
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

  await prisma.scheduleConfig.upsert({
    where: { competitionId: competition.id },
    create: {
      competitionId: competition.id,
      matchesPerTeam: 6,
      numberOfFields: 1,
      cycleTimeMinutes: 5,
      startTime: new Date("2025-02-15T09:00:00.000Z"),
      minMatchesBetween: 1,
      randomSeed: 42,
    },
    update: {
      matchesPerTeam: 6,
      numberOfFields: 1,
      cycleTimeMinutes: 5,
      startTime: new Date("2025-02-15T09:00:00.000Z"),
      minMatchesBetween: 1,
      randomSeed: 42,
    },
  });

  for (const team of teams) {
    await prisma.competitionTeam.upsert({
      where: {
        competitionId_teamId: {
          competitionId: competition.id,
          teamId: team.id,
        },
      },
      create: { competitionId: competition.id, teamId: team.id },
      update: {},
    });
  }

  const demoScorer = await prisma.user.upsert({
    where: { username: "demo-scorekeeper" },
    create: {
      username: "demo-scorekeeper",
      email: "demo-scorekeeper@example.test",
      passwordHash: "!seeded-demo-user-no-login",
      isActive: true,
    },
    update: { isActive: true },
  });

  await prisma.competitionRole.upsert({
    where: {
      userId_competitionId_role: {
        userId: demoScorer.id,
        competitionId: competition.id,
        role: "scorekeeper",
      },
    },
    create: {
      userId: demoScorer.id,
      competitionId: competition.id,
      role: "scorekeeper",
    },
    update: {},
  });

  const demoMatch = await prisma.match.upsert({
    where: {
      competition_stage_match_number: {
        competitionId: competition.id,
        stage: "qualification",
        matchNumber: 1,
      },
    },
    create: {
      competitionId: competition.id,
      stage: "qualification",
      matchNumber: 1,
      scheduledTime: new Date("2025-02-15T09:00:00.000Z"),
      fieldNumber: 1,
    },
    update: {
      scheduledTime: new Date("2025-02-15T09:00:00.000Z"),
      fieldNumber: 1,
    },
  });

  for (const [index, team] of teams.slice(0, 4).entries()) {
    await prisma.matchTeam.upsert({
      where: {
        matchId_teamId: { matchId: demoMatch.id, teamId: team.id },
      },
      create: {
        matchId: demoMatch.id,
        teamId: team.id,
        alliance: index < 2 ? "red" : "blue",
      },
      update: { alliance: index < 2 ? "red" : "blue" },
    });
  }

  console.log(
    `Seeded ${scoringConfig.name}, ${teams.length} FTC teams, ${competition.name}, and qualification match 1.`,
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
