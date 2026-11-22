import { useForm } from "@tanstack/react-form"
import { ChevronDownIcon } from "lucide-react"
import { useState } from "react"
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
  ConnectionsQuery,
  UpdateConnectionInput,
} from "#/gql/graphql"
import { useUpdateConnection } from "#/hooks/use-update-connection"
import {
  AUTH_TYPE_LABELS,
  DEFAULT_HEADER_NAME,
  DEFAULT_HEADER_PREFIX,
} from "#/lib/auth-type"
import { errorCode } from "#/lib/graphql-error"

type Connection = ConnectionsQuery["connections"][number]

// The order the dialog lists the auth types in (REQ-CONN-081).
const AUTH_TYPES: AuthType[] = ["OAUTH_DCR", "OAUTH_MANUAL", "API_KEY", "NONE"]

function defaultValues(connection: Connection) {
  return {
    displayName: connection.displayName,
    url: connection.url,
    authType: connection.authType,
    // Secrets are write-only: the inputs start empty (REQ-CONN-082).
    apiKey: "",
    clearApiKey: false,
    headerName: connection.headerName ?? DEFAULT_HEADER_NAME,
    headerPrefix: connection.headerPrefix ?? DEFAULT_HEADER_PREFIX,
    oauthClientId: connection.oauthClientId ?? "",
    oauthClientSecret: "",
    clearClientSecret: false,
  }
}
type Values = ReturnType<typeof defaultValues>

interface EditServerDialogProps {
  connection: Connection
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Changes a custom server (REQ-CONN-023, REQ-CONN-082). Only changed fields
// are sent. A secret left empty keeps its stored value.
export function EditServerDialog({
  connection,
  open,
  onOpenChange,
}: EditServerDialogProps) {
  const { update } = useUpdateConnection()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: defaultValues(connection),
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      const input = toUpdateInput(value, connection)
      try {
        if (Object.keys(input).length > 0) await update(connection.id, input)
        close()
      } catch (error) {
        setSubmitError(updateErrorMessage(error, value.displayName.trim()))
      }
    },
  })

  function close() {
    form.reset(defaultValues(connection))
    setSubmitError(null)
    onOpenChange(false)
  }

  const apiKeyFields = () => (
    <>
      <form.Subscribe selector={(state) => state.values.clearApiKey}>
        {(cleared) => (
          <form.Field name="apiKey">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>API key</FieldLabel>
                <FieldDescription>
                  {secretState(connection.hasApiKey, cleared)}
                </FieldDescription>
                <div className="flex gap-2">
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="off"
                    placeholder={
                      connection.hasApiKey
                        ? "Enter a new key to replace it"
                        : ""
                    }
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value)
                      form.setFieldValue("clearApiKey", false)
                    }}
                    onBlur={field.handleBlur}
                  />
                  {connection.hasApiKey && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        field.handleChange("")
                        form.setFieldValue("clearApiKey", !cleared)
                      }}
                    >
                      {cleared ? "Keep" : "Clear"}
                    </Button>
                  )}
                </div>
              </Field>
            )}
          </form.Field>
        )}
      </form.Subscribe>
      <Collapsible>
        <CollapsibleTrigger
          render={<Button type="button" variant="ghost" size="sm" />}
          className="group/advanced -ml-2"
        >
          Advanced settings
          <ChevronDownIcon className="transition-transform group-data-[panel-open]/advanced:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 pt-2">
          <form.Field name="headerName">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Header name</FieldLabel>
                <Input
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

  const clientFields = () => (
    <>
      <form.Field name="oauthClientId">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>Client id</FieldLabel>
            <Input
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
      <form.Subscribe selector={(state) => state.values.clearClientSecret}>
        {(cleared) => (
          <form.Field name="oauthClientSecret">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Client secret</FieldLabel>
                <FieldDescription>
                  {secretState(connection.hasClientSecret, cleared)}
                </FieldDescription>
                <div className="flex gap-2">
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="off"
                    placeholder={
                      connection.hasClientSecret
                        ? "Enter a new secret to replace it"
                        : ""
                    }
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value)
                      form.setFieldValue("clearClientSecret", false)
                    }}
                    onBlur={field.handleBlur}
                  />
                  {connection.hasClientSecret && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        field.handleChange("")
                        form.setFieldValue("clearClientSecret", !cleared)
                      }}
                    >
                      {cleared ? "Keep" : "Clear"}
                    </Button>
                  )}
                </div>
              </Field>
            )}
          </form.Field>
        )}
      </form.Subscribe>
    </>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {connection.displayName}</DialogTitle>
          <DialogDescription>
            Stored secrets are never shown. Leave a secret empty to keep it.
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
                  <Field data-invalid={invalid}>
                    <FieldLabel htmlFor={field.name}>MCP server URL</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="url"
                      autoComplete="off"
                      value={field.state.value}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
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

            <form.Subscribe
              selector={(state) => [state.values.authType, state.values.url]}
            >
              {([authType, url]) => (
                <>
                  {authType === "API_KEY" && apiKeyFields()}
                  {authType === "OAUTH_MANUAL" && clientFields()}
                  {dropsCredentials(connection, authType as AuthType, url) && (
                    <p role="status" className="text-sm text-muted-foreground">
                      Changing the URL or the authentication deletes the stored
                      credentials, unless you enter new ones here.
                    </p>
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
                  {isSubmitting ? "Saving…" : "Save"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// What the form says about a stored secret (REQ-CONN-082).
function secretState(stored: boolean, cleared: boolean) {
  if (cleared) return "Set. It will be deleted when you save."
  return stored ? "Set" : "Not set"
}

// Whether saving would delete stored credentials (REQ-CONN-023).
function dropsCredentials(
  connection: Connection,
  authType: AuthType,
  url: string,
) {
  const hasCredentials =
    connection.hasApiKey ||
    connection.hasClientSecret ||
    connection.oauthClientId !== null
  return (
    hasCredentials &&
    (authType !== connection.authType || url.trim() !== connection.url)
  )
}

// Sends only what changed. For a secret: left out keeps it, null deletes it,
// a string replaces it (REQ-CONN-042).
function toUpdateInput(
  value: Values,
  connection: Connection,
): UpdateConnectionInput {
  const input: UpdateConnectionInput = {}
  const displayName = value.displayName.trim()
  const url = value.url.trim()
  const authTypeChanged = value.authType !== connection.authType
  if (displayName !== connection.displayName) input.displayName = displayName
  if (url !== connection.url) input.url = url
  if (authTypeChanged) input.authType = value.authType

  if (value.authType === "API_KEY") {
    if (value.apiKey !== "") input.apiKey = value.apiKey
    else if (value.clearApiKey) input.apiKey = null
    const headerName = value.headerName.trim()
    const headerPrefix = value.headerPrefix.trim()
    if (authTypeChanged || headerName !== connection.headerName) {
      input.headerName = headerName
    }
    if (authTypeChanged || headerPrefix !== connection.headerPrefix) {
      input.headerPrefix = headerPrefix
    }
  }
  if (value.authType === "OAUTH_MANUAL") {
    const clientId = value.oauthClientId.trim()
    if (authTypeChanged || clientId !== (connection.oauthClientId ?? "")) {
      input.oauthClientId = clientId
    }
    if (value.oauthClientSecret !== "") {
      input.oauthClientSecret = value.oauthClientSecret
    } else if (value.clearClientSecret) {
      input.oauthClientSecret = null
    }
  }
  return input
}

function updateErrorMessage(error: unknown, name: string) {
  switch (errorCode(error)) {
    case "CONFLICT":
      return `You already have a server named ${name}.`
    case "NOT_FOUND":
      return "This server no longer exists."
    case "VALIDATION":
      return "The server did not accept these settings. Check the URL and the header name."
    default:
      return "Could not save the changes. Try again."
  }
}

// FieldError takes objects with a message; the validators return strings.
function toErrors(errors: unknown[]) {
  return errors.map((error) => ({ message: String(error) }))
}
