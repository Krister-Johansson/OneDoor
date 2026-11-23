import { useForm } from "@tanstack/react-form"
import { useState } from "react"
import { Button } from "#/components/ui/button"
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
import type { SetCatalogOAuthClientInput } from "#/gql/graphql"
import { useSetCatalogOAuthClient } from "#/hooks/use-set-catalog-oauth-client"
import { errorCode } from "#/lib/graphql-error"
import { RedirectUriNote } from "./redirect-uri-note"

interface OAuthApp {
  oauthClientId: string | null
  hasClientSecret: boolean
}

function defaultValues(app: OAuthApp) {
  return {
    clientId: app.oauthClientId ?? "",
    // Secrets are write-only: the input starts empty (REQ-CONN-082).
    clientSecret: "",
    clearClientSecret: false,
  }
}
type Values = ReturnType<typeof defaultValues>

interface OAuthAppDialogProps {
  catalogEntryId: string
  serverName: string
  app: OAuthApp
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Sets the OAuth app of a catalog server (T22): the client id and the
// client secret of the app the owner registered with the provider. Every
// connection to the server uses it.
export function OAuthAppDialog({
  catalogEntryId,
  serverName,
  app,
  open,
  onOpenChange,
}: OAuthAppDialogProps) {
  const { setOAuthClient } = useSetCatalogOAuthClient()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: defaultValues(app),
    onSubmit: async ({ value }) => {
      setSubmitError(null)
      try {
        await setOAuthClient(catalogEntryId, toInput(value))
        close()
      } catch (error) {
        setSubmitError(saveErrorMessage(error, serverName))
      }
    },
  })

  function close() {
    form.reset(defaultValues(app))
    setSubmitError(null)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>OAuth app for {serverName}</DialogTitle>
          <DialogDescription>
            Register an OAuth app with {serverName} and enter its details.
            Stored secrets are never shown. Leave the secret empty to keep it.
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
            <RedirectUriNote />
            <form.Field
              name="clientId"
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
            <form.Subscribe
              selector={(state) => state.values.clearClientSecret}
            >
              {(cleared) => (
                <form.Field name="clientSecret">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>
                        Client secret
                      </FieldLabel>
                      <FieldDescription>
                        {secretState(app.hasClientSecret, cleared)}
                      </FieldDescription>
                      <div className="flex gap-2">
                        <Input
                          id={field.name}
                          name={field.name}
                          type="password"
                          autoComplete="off"
                          placeholder={
                            app.hasClientSecret
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
                        {app.hasClientSecret && (
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

// The client id is always sent. For the secret: left out keeps it, null
// deletes it, a string replaces it.
function toInput(value: Values): SetCatalogOAuthClientInput {
  const input: SetCatalogOAuthClientInput = { clientId: value.clientId.trim() }
  if (value.clientSecret !== "") input.clientSecret = value.clientSecret
  else if (value.clearClientSecret) input.clientSecret = null
  return input
}

function saveErrorMessage(error: unknown, name: string) {
  switch (errorCode(error)) {
    case "NOT_FOUND":
      return `${name} is no longer in the catalog.`
    case "VALIDATION":
      return "The server did not accept these details. Check the client id."
    default:
      return "Could not save the OAuth app. Try again."
  }
}

// FieldError takes objects with a message; the validators return strings.
function toErrors(errors: unknown[]) {
  return errors.map((error) => ({ message: String(error) }))
}
