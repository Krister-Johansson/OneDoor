// Starts everything the flows run against: Postgres and Redis in containers,
// the fake upstream server, the OneDoor server built from ../server, and the
// web app built with API_URL pointing at it. Returns the teardown.
//
// The server is run as a separate process from its own folder. web imports
// no server code.
import { type ChildProcess, execFile, spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { mkdirSync, openSync } from "node:fs"
import { join, resolve } from "node:path"
import { promisify } from "node:util"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { RedisContainer } from "@testcontainers/redis"
import { startOpenTwin } from "./twins/open-twin"

const execFileAsync = promisify(execFile)

const WEB_DIR = resolve(import.meta.dirname, "..")
const SERVER_DIR = resolve(WEB_DIR, "../server")
const LOG_DIR = join(WEB_DIR, "test-results")

// The same images as docker-compose.yml.
const POSTGRES_IMAGE = "pgvector/pgvector:0.8.7-pg19-trixie"
const REDIS_IMAGE = "redis:8.8.4-alpine"

export const API_PORT = 3100
export const WEB_PORT = 3101
const API_URL = `http://127.0.0.1:${API_PORT}`
const API_SOCKET_URL = `ws://127.0.0.1:${API_PORT}/graphql`
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`

export default async function globalSetup() {
  const [postgres, redis, twin] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).start(),
    new RedisContainer(REDIS_IMAGE).start(),
    startOpenTwin(),
  ])
  // The flows read the twin's URL from here.
  process.env.E2E_TWIN_URL = twin.url

  const serverEnv = {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(API_PORT),
    DATABASE_URL: postgres.getConnectionUri(),
    REDIS_URL: redis.getConnectionUrl(),
    SECRET_STORE: "aes-256-gcm",
    SECRET_STORE_KEY_ID: "e2e-1",
    SECRET_STORE_KEY: randomBytes(32).toString("base64"),
    // Icon fetching would reach the catalog servers on the internet.
    ICON_FETCHING: "false",
    // Upstream clients connect only NONE connections, and no catalog entry
    // in the seed is NONE, so they reach only the twin.
    UPSTREAM_CONNECTING: "true",
  }
  await run(
    "pnpm",
    ["exec", "prisma", "migrate", "deploy"],
    SERVER_DIR,
    serverEnv,
  )
  await run("pnpm", ["exec", "prisma", "db", "seed"], SERVER_DIR, serverEnv)
  // Its own output folder, so a running `pnpm dev` keeps its dist.
  await run(
    "pnpm",
    ["exec", "tsc", "-p", "tsconfig.build.json", "--outDir", ".e2e-build"],
    SERVER_DIR,
    process.env,
  )

  const webEnv = {
    ...process.env,
    API_URL,
    VITE_GRAPHQL_WS_URL: API_SOCKET_URL,
  }
  await run("pnpm", ["exec", "vite", "build"], WEB_DIR, webEnv)

  mkdirSync(LOG_DIR, { recursive: true })
  const api = start(
    "node",
    [".e2e-build/main.js"],
    SERVER_DIR,
    serverEnv,
    "api",
  )
  const web = start(
    "node",
    [".output/server/index.mjs"],
    WEB_DIR,
    { ...webEnv, HOST: "127.0.0.1", PORT: String(WEB_PORT) },
    "web",
  )

  const stop = async () => {
    web.kill()
    api.kill()
    await Promise.allSettled([twin.close(), redis.stop(), postgres.stop()])
  }
  try {
    await waitFor(`${API_URL}/health/ready`)
    await waitFor(`${WEB_URL}/servers`)
  } catch (error) {
    await stop()
    throw error
  }
  return stop
}

async function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
) {
  await execFileAsync(command, args, { cwd, env })
}

// Starts a long-running process with its output in test-results/<name>.log.
function start(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  name: string,
): ChildProcess {
  const log = openSync(join(LOG_DIR, `${name}.log`), "w")
  return spawn(command, args, { cwd, env, stdio: ["ignore", log, log] })
}

async function waitFor(url: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((done) => setTimeout(done, 250))
  }
  throw new Error(
    `${url} did not answer within ${timeoutMs / 1000} seconds. See web/test-results/*.log.`,
  )
}
