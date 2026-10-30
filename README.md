# Solution1

Aspire app: ASP.NET Core (.NET 10) API + React / Material UI / Vite frontend, with user accounts (ASP.NET Core Identity on PostgreSQL) and a Redis output cache.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 26 LTS](https://nodejs.org/) (minimum 24.15; the version is pinned in `src/frontend/.nvmrc`)
- Docker or Podman: Aspire runs Redis, PostgreSQL and pgAdmin in containers, and the API tests start a PostgreSQL container (Testcontainers)
- [Aspire CLI](https://aspire.dev) (optional, for `aspire run`)

## Run

```bash
aspire run
# or
dotnet run --project src/AspireApp1.AppHost
```

Emails (e.g. email confirmation) go to **Mailpit** in development: open the `mailpit` resource's
web inbox from the Aspire dashboard. Nothing is sent to real addresses.

## Test

```bash
dotnet tool restore                         # first time only (dotnet-ef for migrations)
dotnet test                                 # server unit + API tests (needs Docker)
npm --prefix src/frontend install           # first time only
npm --prefix src/frontend test              # frontend tests (Vitest)
npm --prefix src/frontend run lint
npm --prefix src/frontend run build
```

Without Docker, point the API tests at an existing PostgreSQL server instead:
`TEST_POSTGRES_CONNECTION="Host=localhost;Username=postgres;Password=..." dotnet test`
(each run creates and afterwards drops its own `test_*` databases).
