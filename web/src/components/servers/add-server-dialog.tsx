import { useForm } from "@tanstack/react-form"
import { ChevronDownIcon } from "lucide-react"
import { useRef, useState } from "react"
import { Badge } from "#/components/ui/badge"
import { Button } from "#/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "#/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "#/components/ui/field"
import { Input } from "#/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select"
import type {
  AuthType,
  CheckCredentialsMutation,
  CreateConnectionInput,
  ProbeServerMutation,
} from "#/gql/graphql"
import { useCheckCredentials } from "#/hooks/use-check-credentials"
import { useCreateConnection } from "#/hooks/use-create-connection"
import { useProbeServer } from "#/hooks/use-probe-server"
import {
  AUTH_TYPE_LABELS,
  DEFAULT_HEADER_NAME,
  DEFAULT_HEADER_PREFIX,
} from "#/lib/auth-type"
import { errorCode } from "#/lib/graphql-error"

type ProbeResult = ProbeServerMutation["probeServer"]
type CheckResult = CheckCredentialsMutation["checkCredentials"]

// The order the dialog lists the auth types in (REQ-CONN-081).
const AUTH_TYPES: AuthType[] = ["OAUTH_DCR", "OAUTH_MANUAL", "API_KEY", "NONE"]

const DEFAULT_VALUES = {
  displayName: "",
  url: "",
  authType: "NONE" as AuthType,
  apiKey: "",
  headerName: DEFAULT_HEADER_NAME,
  headerPrefix: DEFAULT_HEADER_PREFIX,
  oauthClientId: "",
  oauthClientSecret: "",
}
type Values = typeof DEFAULT_VALUES

interface AddServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Adds a custom server (REQ-CONN-081). Leaving the URL field probes the
// server and fills in the name and auth type (REQ-CONN-060, REQ-CONN-061).
export function AddServerDialog({ open, onOpenChange }: AddServerDialogProps) {
  const { create } = useCreateConnection()
  const { probe, loading: probing } = useProbeServer()
  const { check, loading: checking } = useCheckCredentials()
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null)
  const [urlProblem, setUrlProblem] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // The last URL probed, and the values the probe filled in. A field the
  // user has changed since is not filled in again.
  const probedUrl = useRef("")
  const filled = useRef({ displayName: "", authType: "NONE" as AuthType })

  const form = useForm({
    defaultValues: DEFAULT_VALUES,
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        await create(toCreateInput(value))
        close()
      } catch (error) {
        setSubmitError(createErrorMessage(error, value.displayName.trim()))
      }
    },
  })

  function close() {
    form.reset()
    setProbeResult(null)
    setUrlProblem(null)
    setCheckResult(null)
    setCheckError(null)
    setSubmitError(null)
    probedUrl.current = ""
    filled.current = { displayName: "", authType: "NONE" }
    onOpenChange(false)
  }

  async function runProbe(rawUrl: string) {
    const url = rawUrl.trim()
    if (url === "" || url === probedUrl.current) return
    probedUrl.current = url
    setProbeResult(null)
    setUrlProblem(null)
    setCheckResult(null)
    try {
      const result = await probe(url)
      // A newer probe has started; its result wins.
      if (!result || probedUrl.current !== url) return
      setProbeResult(result)
      prefill(result)
    } catch (error) {
      if (probedUrl.current !== url) return
      setUrlProblem(
        errorCode(error) === "VALIDATION"
          ? "Use https, or http only for localhost and 127.0.0.1."
          : "Could not check the server. Try again.",
      )
    }
  }

  function prefill(result: ProbeResult) {
    const name = result.serverTitle ?? result.serverName
    const currentName = form.getFieldValue("displayName")
    if (
      name &&
      (currentName === "" || currentName === filled.current.displayName)
    ) {
      form.setFieldValue("displayName", name)
      filled.current.displayName = name
    }
    const authType = result.suggestedAuthType
    if (
      authType &&
      form.getFieldValue("authType") === filled.current.authType
    ) {
      form.setFieldValue("authType", authType)
      filled.current.authType = authType
    }
  }

  async function runCheck() {
    const value = form.state.values
    setCheckResult(null)
    setCheckError(null)
    try {
      const input = toCreateInput(value)
      const result = await check({
        url: input.url,
        authType: input.authType,
        apiKey: input.apiKey,
        headerName: input.headerName,
        headerPrefix: input.headerPrefix,
      })
      if (result) setCheckResult(result)
    } catch {
      setCheckError("Could not check. Fill in the URL and the key first.")
    }
  }

  // The key, and the header it goes in under "Advanced settings" (REQ-CONN-081).
  const apiKeyFields = () => (
    <>
      <form.Field
        name="apiKey"
        validators={{
          onChange: ({ value }) =>
            value === "" ? "Enter the API key." : undefined,
        }}
      >
        {(field) => {
          const invalid =
            field.state.meta.isTouched && !field.state.meta.isValid
          return (
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor={field.name}>API key</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="off"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={invalid}
              />
              {invalid && (
                <FieldError errors={toErrors(field.state.meta.errors)} />
              )}
            </Field>
          )
        }}
      </form.Field>
      <Collapsible>
        <CollapsibleTrigger
          render={<Button type="button" variant="ghost" size="sm" />}
          className="group/advanced -mx-2 w-[calc(100%+1rem)] justify-between"
        >
          Advanced settings
          <ChevronDownIcon className="transition-transform group-data-[panel-open]/advanced:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="grid gap-4 pt-2 sm:grid-cols-2">
          <form.Field name="headerName">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Header name</FieldLabel>
                <Input
                  className="font-mono"
                  id={field.name}
                  name={field.name}
                  autoComplete="off"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="headerPrefix">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Header prefix</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  autoComplete="off"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldDescription>
                  Sent before the key, with a space. May be empty.
                </FieldDescription>
              </Field>
            )}
          </form.Field>
        </CollapsibleContent>
      </Collapsible>
    </>
  )

  // The client details for OAuth with client details (REQ-CONN-081).
  const clientFields = () => (
    <>
      <form.Field
        name="oauthClientId"
        validators={{
          onChange: ({ value }) =>
            value.trim() === "" ? "Enter the client id." : undefined,
        }}
      >
        {(field) => {
          const invalid =
            field.state.meta.isTouched && !field.state.meta.isValid
          return (
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor={field.name}>Client id</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                autoComplete="off"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={invalid}
              />
              {invalid && (
                <FieldError errors={toErrors(field.state.meta.errors)} />
              )}
            </Field>
          )
        }}
      </form.Field>
      <form.Field
        name="oauthClientSecret"
        validators={{
          onChange: ({ value }) =>
            value === "" ? "Enter the client secret." : undefined,
        }}
      >
        {(field) => {
          const invalid =
            field.state.meta.isTouched && !field.state.meta.isValid
          return (
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor={field.name}>Client secret</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="off"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                aria-invalid={invalid}
              />
              {invalid && (
                <FieldError errors={toErrors(field.state.meta.errors)} />
              )}
            </Field>
          )
        }}
      </form.Field>
    </>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add server
            <Badge variant="secondary">Remote MCP only</Badge>
          </DialogTitle>
          <DialogDescription>
            An MCP server of your own, reached over HTTP.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            <form.Field
              name="url"
              validators={{
                onChange: ({ value }) =>
                  value.trim() === "" ? "Enter the server's URL." : undefined,
              }}
            >
              {(field) => {
                const invalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={invalid || urlProblem !== null}>
                    <FieldLabel htmlFor={field.name}>MCP server URL</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="url"
                      placeholder="https://mcp.example.com/mcp"
                      autoComplete="off"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={() => {
                        field.handleBlur()
                        void runProbe(field.state.value)
                      }}
                      aria-invalid={invalid || urlProblem !== null}
                    />
                    {probing && (
                      <FieldDescription>Checking the server…</FieldDescription>
                    )}
                    {probeResult && (
                      <FieldDescription>{probeResult.message}</FieldDescription>
                    )}
                    {urlProblem && <FieldError>{urlProblem}</FieldError>}
                    {invalid && (
                      <FieldError errors={toErrors(field.state.meta.errors)} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field
              name="displayName"
              validators={{
                onChange: ({ value }) => {
                  const name = value.trim()
                  if (name === "") return "Enter a name."
                  if (name.length > 60) return "Use at most 60 characters."
                  return undefined
                },
              }}
            >
              {(field) => {
                const invalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={invalid}>
                    <FieldLabel htmlFor={field.name}>Display name</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      autoComplete="off"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      onBlur={field.handleBlur}
                      aria-invalid={invalid}
                    />
                    <FieldDescription>
                      Agents see this as the server name.
                    </FieldDescription>
                    {invalid && (
                      <FieldError errors={toErrors(field.state.meta.errors)} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="authType">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Authentication</FieldLabel>
                  <Select
                    items={AUTH_TYPE_LABELS}
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value) field.handleChange(value)
                      setCheckResult(null)
                    }}
                  >
                    <SelectTrigger id={field.name} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTH_TYPES.map((authType) => (
                        <SelectItem key={authType} value={authType}>
                          {AUTH_TYPE_LABELS[authType]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.values.authType}>
              {(authType) => (
                <>
                  {authType === "API_KEY" && apiKeyFields()}
                  {authType === "OAUTH_MANUAL" && clientFields()}
                  {(authType === "NONE" || authType === "API_KEY") && (
                    <Field>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={checking}
                        onClick={() => void runCheck()}
                      >
                        {checking ? "Checking…" : "Check connection"}
                      </Button>
                      {checkResult && (
                        <FieldDescription
                          role="status"
                          className={
                            checkResult.status === "OK"
                              ? undefined
                              : "text-destructive"
                          }
                        >
                          {checkResult.message}
                          {checkResult.toolNames.length > 0 &&
                            ` Tools: ${checkResult.toolNames.join(", ")}.`}
                        </FieldDescription>
                      )}
                      {checkError && <FieldError>{checkError}</FieldError>}
                    </Field>
                  )}
                </>
              )}
            </form.Subscribe>

            {submitError && (
              <p role="alert" className="text-destructive text-sm">
                {submitError}
              </p>
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding…" : "Add server"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Sends only the fields the chosen auth type uses.
function toCreateInput(value: Values): CreateConnectionInput {
  const base = {
    displayName: value.displayName.trim(),
    url: value.url.trim(),
    authType: value.authType,
  }
  switch (value.authType) {
    case "API_KEY":
      return {
        ...base,
        apiKey: value.apiKey,
        headerName: value.headerName.trim(),
        headerPrefix: value.headerPrefix.trim(),
      }
    case "OAUTH_MANUAL":
      return {
        ...base,
        oauthClientId: value.oauthClientId.trim(),
        oauthClientSecret: value.oauthClientSecret,
      }
    default:
      return base
  }
}

function createErrorMessage(error: unknown, name: string) {
  switch (errorCode(error)) {
    case "CONFLICT":
      return `You already have a server named ${name}.`
    case "VALIDATION":
      return "The server did not accept these settings. Check the URL and the header name."
    default:
      return "Could not add the server. Try again."
  }
}

// FieldError takes objects with a message; the validators return strings.
function toErrors(errors: unknown[]) {
  return errors.map((error) => ({ message: String(error) }))
}
