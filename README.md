# Solution1

Aspire app: ASP.NET Core (.NET 10) API + React / Vite frontend + Redis output cache.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 26 LTS](https://nodejs.org/) (minimum 24.15; the version is pinned in `src/frontend/.nvmrc`)
- Docker or Podman (Aspire runs Redis in a container)
- [Aspire CLI](https://aspire.dev) (optional, for `aspire run`)

## Run

```bash
aspire run
# or
dotnet run --project src/AspireApp1.AppHost
```

## Test

```bash
dotnet test                                 # server unit + API tests
npm --prefix src/frontend install           # first time only
npm --prefix src/frontend test              # frontend tests (Vitest)
npm --prefix src/frontend run lint
npm --prefix src/frontend run build
```
