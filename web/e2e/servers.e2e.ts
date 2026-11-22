import { expect, test } from "@playwright/test"
import { OPEN_TWIN_TITLE } from "./twins/open-twin"

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
  const row = page.getByRole("listitem").filter({ hasText: OPEN_TWIN_TITLE })
  await expect(row).toContainText(twinUrl())
  await expect(row).toContainText("No authentication")
  await expect(row).toContainText("Enabled")
})

test("switches catalog entries on and off, and asks for the auth option when there are two (REQ-CONN-080)", async ({
  page,
}) => {
  await page.goto("/servers")

  const github = page.getByRole("switch", { name: "Use GitHub" })
  await expect(github).not.toBeChecked()
  await github.click()
  await expect(github).toBeChecked()
  await github.click()
  await expect(github).not.toBeChecked()

  const context7 = page.getByRole("switch", { name: "Use Context7" })
  await context7.click()
  const choice = page.getByRole("dialog", { name: "Connect to Context7" })
  await choice.getByRole("button", { name: /DCR OAuth/ }).click()
  await expect(choice).toBeHidden()
  await expect(context7).toBeChecked()

  // The choice is stored: after a reload the switch is still on.
  await page.reload()
  await expect(page.getByRole("switch", { name: "Use Context7" })).toBeChecked()
})
