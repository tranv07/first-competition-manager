# FIRST Competition Manager

An open-source platform for managing FIRST Robotics competitions, with tools for team registration, event organization, match scheduling, and results tracking. Built to simplify competition management and support collaboration across teams and organizers.

> **Status:** early development. The architecture and features below describe the planned scope.

## Features

**Event and team management**
- Create and configure events
- Register teams manually or import team lists

**Match scheduling**
- Qualification schedule generator with balanced partners and opponents
- Configurable match counts and timing

**Scoring and results**
- Referee scoring entry, optimized for tablets
- Live rankings with configurable ranking points and tiebreakers
- Season-specific rules kept configurable instead of hard-coded

**Playoffs and awards**
- Alliance selection
- Playoff bracket
- Awards tracking

**Live displays**
- Audience screen, pit display, and team lookup
- Real-time updates via WebSockets

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Frontend | React + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| Forms | React Hook Form + Zod |
| Backend | Node.js with Hono |
| Real-time | Socket.IO (later) |
| Database | PostgreSQL |
| ORM | Prisma |
| Validation | Zod (schemas shared) |
| Local development | Docker Compose |
| Tooling | ESLint + Prettier, Vitest, Playwright (later), GitHub Actions (later) |

## Project Structure

Planned layout:

```
first-competition-manager/
├── apps/
│   ├── web/          # React + Vite frontend
│   └── server/       # Hono API + Socket.IO
├── packages/
│   ├── db/           # Database schema and migrations
│   └── shared/       # Zod schemas and shared types
├── docker-compose.yml
├── package.json      # npm workspaces configuration
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (current LTS, includes npm)
- Docker and Docker Compose

### Setup

```bash
# Clone the repository
git clone https://github.com/tranv07/first-competition-manager.git
cd first-competition-manager

# Install dependencies
npm install

# Start PostgreSQL
docker compose up -d

# Configure environment variables
cp .env.example .env

# Run database migrations
npm run db:migrate

# Start frontend and backend in development mode
npm run dev
```

> These commands reflect the planned setup and may change as the project takes shape.

## Contributing

Contributions are welcome. Open an issue to discuss larger changes before submitting a pull request, and make sure lint, type checks, and tests pass.

## Disclaimer

This project is not affiliated with or endorsed by FIRST®. FIRST® is a registered trademark of For Inspiration and Recognition of Science and Technology (FIRST).