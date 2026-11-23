import { expect, test } from "@playwright/test"
import { OPEN_TWIN_TITLE, OPEN_TWIN_TOOLS } from "./twins/open-twin"

function twinUrl(): string {
  const url = process.env.E2E_TWIN_URL
  if (!url) throw new Error("E2E_TWIN_URL is not set; global setup did not run")
  return url
}

test("adds a server through the dialog, with probe pre-fill and a credentials check (REQ-CONN-061, REQ-CONN-062, REQ-CONN-081)", async ({
  page,
}) => {
  await page.goto("/servers")
  await expect(page.getByText("No servers yet")).toBeVisible()

  await page.getByRole("button", { name: "Add server" }).click()
  const dialog = page.getByRole("dialog", { name: "Add server" })
  await dialog.getByLabel("MCP server URL").fill(twinUrl())
  await dialog.getByLabel("MCP server URL").blur()

  await expect(
    dialog.getByText(
      "The server answered as an MCP server without credentials.",
    ),
  ).toBeVisible()
  await expect(dialog.getByLabel("Display name")).toHaveValue(OPEN_TWIN_TITLE)
  await expect(
    dialog.getByRole("combobox", { name: "Authentication" }),
  ).toContainText("No authentication")

  await dialog.getByRole("button", { name: "Check connection" }).click()
  await expect(
    dialog.getByText(
      "Connected. The server has 2 tools. Tools: echo, reverse.",
    ),
  ).toBeVisible()

  await dialog.getByRole("button", { name: "Add server" }).click()
  await expect(dialog).toBeHidden()
  const server = page.getByRole("listitem").filter({ hasText: OPEN_TWIN_TITLE })
  await expect(server).toContainText("Active")

  // The card opens the server's page, which holds its settings.
  await server.getByRole("link").click()
  await expect(
    page.getByRole("heading", { level: 1, name: OPEN_TWIN_TITLE }),
  ).toBeVisible()
  await expect(page.getByText(twinUrl())).toBeVisible()
  const connection = page.getByRole("region", { name: "Connection" })
  await expect(connection).toContainText("No authentication")
  await expect(
    connection.getByRole("switch", { name: `Use ${OPEN_TWIN_TITLE}` }),
  ).toBeChecked()
})

test("adds catalog entries, turns them off on their page, and asks for the auth option when there are two (REQ-CONN-080)", async ({
  page,
}) => {
  await page.goto("/servers")

  // Adding an entry opens the new server's page, where its switch is.
  await page.getByRole("button", { name: "Add GitHub" }).click()
  await expect(page).toHaveURL(/\/servers\/[0-9a-f-]{36}$/)
  const github = page.getByRole("switch", { name: "Use GitHub" })
  await expect(github).toBeChecked()
  await github.click()
  await expect(github).not.toBeChecked()
  await page.getByRole("link", { name: "Back to servers" }).click()
  await expect(card(page, "GitHub")).toContainText("Off")

  await page.getByRole("button", { name: "Add Context7" }).click()
  const choice = page.getByRole("dialog", { name: "Connect to Context7" })
  await choice.getByRole("button", { name: /DCR OAuth/ }).click()
  await expect(choice).toBeHidden()
  await expect(page).toHaveURL(/\/servers\/[0-9a-f-]{36}$/)
  await expect(page.getByRole("switch", { name: "Use Context7" })).toBeChecked()
  await expect(page.getByRole("region", { name: "Connection" })).toContainText(
    "DCR OAuth · Needs credentials",
  )

  // The choice is stored: after a reload the switch is still on.
  await page.reload()
  await expect(page.getByRole("switch", { name: "Use Context7" })).toBeChecked()
})

// The card of a server on the servers screen. It is a link to the server's
// page once the server has a connection.
function card(page: import("@playwright/test").Page, name: string) {
  return page.getByRole("listitem").filter({ hasText: name })
}

// Changes a connection from outside the page, as another tab or the MCP
// endpoint would, through the same /graphql the page uses.
async function graphql(
  request: import("@playwright/test").APIRequestContext,
  query: string,
  variables: Record<string, unknown>,
) {
  const response = await request.post("/graphql", {
    data: { query, variables },
  })
  expect(response.ok()).toBe(true)
  const body = (await response.json()) as {
    data?: Record<string, { id: string }>
    errors?: unknown[]
  }
  expect(body.errors).toBeUndefined()
  return body.data ?? {}
}

test("shows the live status of a server's connection (T17)", async ({
  page,
  request,
}) => {
  const data = await graphql(
    request,
    "mutation ($input: CreateConnectionInput!) { createConnection(input: $input) { id } }",
    { input: { displayName: "Live Twin", url: twinUrl(), authType: "NONE" } },
  )
  const id = data.createConnection?.id

  await page.goto("/servers")
  const row = card(page, "Live Twin")
  await expect(row).toContainText("Active")

  // The page does not reload or refetch: the status arrives over the socket.
  await graphql(
    request,
    "mutation ($id: ID!, $input: UpdateConnectionInput!) { updateConnection(id: $id, input: $input) { id } }",
    { id, input: { url: "http://127.0.0.1:1/mcp" } },
  )
  await expect(row).toContainText("Unreachable")
})

test("shows a server's tool count live and re-syncs its tools (T18)", async ({
  page,
  request,
}) => {
  const data = await graphql(
    request,
    "mutation ($input: CreateConnectionInput!) { createConnection(input: $input) { id } }",
    {
      input: {
        displayName: "Synced Twin",
        url: "http://127.0.0.1:1/mcp",
        authType: "NONE",
      },
    },
  )
  const id = data.createConnection?.id

  await page.goto(`/servers/${id}`)
  const row = page.getByRole("region", { name: "Connection" })
  const resync = row.getByRole("button", { name: "Re-sync tools" })
  // A connection that never synced shows no count, and no re-sync while it
  // is not connected.
  await expect(row).toContainText("Unreachable")
  await expect(row).not.toContainText(/\d+ tools?\b/)

  // The page does not reload or refetch: the count arrives over the socket
  // once the first sync finishes.
  await graphql(
    request,
    "mutation ($id: ID!, $input: UpdateConnectionInput!) { updateConnection(id: $id, input: $input) { id } }",
    { id, input: { url: twinUrl() } },
  )
  await expect(row).toContainText("Connected")
  await expect(row).toContainText(`${OPEN_TWIN_TOOLS.length} tools`)

  // The button waits for the sync to finish, which changes nothing here.
  await resync.click()
  await expect(resync).toBeEnabled()
  await expect(row).toContainText(`${OPEN_TWIN_TOOLS.length} tools`)
  await expect(row.getByRole("alert")).toHaveCount(0)

  // An unreachable server keeps its tools and hides the button.
  await graphql(
    request,
    "mutation ($id: ID!, $input: UpdateConnectionInput!) { updateConnection(id: $id, input: $input) { id } }",
    { id, input: { url: "http://127.0.0.1:1/mcp" } },
  )
  await expect(row).toContainText("Unreachable")
  await expect(row).toContainText(`${OPEN_TWIN_TOOLS.length} tools`)
  await expect(resync).toHaveCount(0)
})

test("opens a server's tools and disables one (T19)", async ({
  page,
  request,
}) => {
  await graphql(
    request,
    "mutation ($input: CreateConnectionInput!) { createConnection(input: $input) { id } }",
    { input: { displayName: "Tools Twin", url: twinUrl(), authType: "NONE" } },
  )
  // The first sync may end before the page's socket opens; the queries
  // fetch again when it does, so the count still shows.

  await page.goto("/servers")
  const row = card(page, "Tools Twin")
  await expect(row).toContainText(`${OPEN_TWIN_TOOLS.length} tools`)
  await row.getByRole("link").click()

  await expect(page).toHaveURL(/\/servers\/[0-9a-f-]{36}$/)
  await expect(
    page.getByRole("heading", { level: 1, name: "Tools Twin" }),
  ).toBeVisible()
  // The sidebar keeps the servers screen marked.
  await expect(
    page.getByRole("link", { name: "Servers", exact: true }),
  ).toHaveAttribute("data-active")
  // A tool opens to show its description and hints.
  await expect(page.getByText("The echo tool.")).toBeHidden()
  await page.getByRole("button", { name: "echo" }).click()
  await expect(page.getByText("The echo tool.")).toBeVisible()
  await expect(page.getByText("Read-only")).toBeVisible()

  // The search keeps the tools that match.
  await page.getByRole("searchbox", { name: "Search tools" }).fill("rev")
  await expect(page.getByRole("switch", { name: "Use echo" })).toHaveCount(0)
  await expect(page.getByRole("switch", { name: "Use reverse" })).toBeVisible()
  await page.getByRole("searchbox", { name: "Search tools" }).fill("")
  const echoSwitch = page.getByRole("switch", { name: "Use echo" })
  await expect(echoSwitch).toBeChecked()
  await expect(page.getByRole("switch", { name: "Use reverse" })).toBeChecked()

  await echoSwitch.click()
  await expect(echoSwitch).not.toBeChecked()
  // The choice is stored, not only shown.
  await page.reload()
  await expect(page.getByRole("switch", { name: "Use echo" })).not.toBeChecked()
  await expect(page.getByRole("switch", { name: "Use reverse" })).toBeChecked()
})

test("shows a message for a server that does not exist (T19)", async ({
  page,
}) => {
  await page.goto("/servers/00000000-0000-4000-8000-000000000000")
  await expect(page.getByRole("alert")).toHaveText(
    "This server does not exist, or it was removed.",
  )
  await page.getByRole("link", { name: "Back to servers" }).click()
  await expect(page).toHaveURL(/\/servers$/)
})

test("authorizes an OAuth server through the browser and comes back to its page (T21)", async ({
  page,
  request,
}) => {
  const oauthTwinUrl = process.env.E2E_OAUTH_TWIN_URL
  if (!oauthTwinUrl) throw new Error("E2E_OAUTH_TWIN_URL is not set")
  await graphql(
    request,
    "mutation ($input: CreateConnectionInput!) { createConnection(input: $input) { id } }",
    {
      input: {
        displayName: "OAuth Twin",
        url: oauthTwinUrl,
        authType: "OAUTH_DCR",
      },
    },
  )

  await page.goto("/servers")
  const row = card(page, "OAuth Twin")
  await expect(row).toContainText("Needs credentials")
  await row.getByRole("link").click()
  // The browser leaves for the twin's /authorize, which sends it back to
  // /oauth/callback on the web server, which the API answers.
  await page.getByRole("button", { name: "Authorize" }).click()

  await expect(page).toHaveURL(/\/servers\/[0-9a-f-]{36}\?oauth=authorized$/)
  await expect(page.getByRole("status")).toHaveText(
    "Authorized. OneDoor is connecting to the server.",
  )
  await expect(
    page.getByRole("heading", { level: 1, name: "OAuth Twin" }),
  ).toBeVisible()
  await expect(page.getByText("Connected")).toBeVisible()
  await expect(page.getByRole("switch", { name: "Use alpha" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Authorize" })).toHaveCount(0)

  await page.getByRole("button", { name: "Dismiss" }).click()
  await expect(page.getByRole("status")).toHaveCount(0)
  await expect(page).toHaveURL(/\/servers\/[0-9a-f-]{36}$/)
})

test("explains an OAuth return that cannot be finished (T21)", async ({
  page,
}) => {
  // A callback with a state OneDoor never issued, as after a stale tab.
  await page.goto("/oauth/callback?code=made-up&state=made-up")
  await expect(page).toHaveURL(/\/servers\?oauth=expired$/)
  await expect(page.getByRole("alert")).toHaveText(
    "That authorization link expired or was already used. Start the authorization again.",
  )
})
