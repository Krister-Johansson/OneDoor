import { useForm } from "@tanstack/react-form"
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
import type { UrlParameterInput } from "#/gql/graphql"

// The server's rule for a value: one URL path segment of letters, digits,
// dots, underscores and hyphens, starting and ending with a letter or digit.
const SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/

interface UrlParametersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverName: string
  // The option's URL with its placeholders, such as
  // https://mcp.dev.azure.com/{organization}.
  url: string
  names: string[]
  onSubmit: (urlParameters: UrlParameterInput[]) => Promise<void>
}

// Asks for the values a catalog server's URL needs, such as the
// organization of Azure DevOps (T22), before switching it on.
export function UrlParametersDialog({
  open,
  onOpenChange,
  serverName,
  url,
  names,
  onSubmit,
}: UrlParametersDialogProps) {
  const empty = () => Object.fromEntries(names.map((name) => [name, ""]))
  const form = useForm({
    defaultValues: empty(),
    onSubmit: async ({ value }) => {
      await onSubmit(
        names.map((name) => ({ name, value: (value[name] ?? "").trim() })),
      )
      form.reset(empty())
    },
  })

  function close() {
    form.reset(empty())
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect to {serverName}</DialogTitle>
          <DialogDescription>
            The server&apos;s URL is <code className="break-all">{url}</code>.
            Fill in the {names.length === 1 ? "part" : "parts"} in braces.
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
            {names.map((name) => (
              <form.Field
                key={name}
                name={name}
                validators={{
                  onChange: ({ value }) => segmentError(value),
                  onSubmit: ({ value }) => segmentError(value),
                }}
              >
                {(field) => {
                  const invalid =
                    (field.state.meta.isTouched ||
                      form.state.submissionAttempts > 0) &&
                    !field.state.meta.isValid
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor={`url-parameter-${name}`}>
                        {label(name)}
                      </FieldLabel>
                      <Input
                        id={`url-parameter-${name}`}
                        name={name}
                        autoComplete="off"
                        value={field.state.value}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        onBlur={field.handleBlur}
                        aria-invalid={invalid}
                      />
                      <FieldDescription>
                        Replaces {`{${name}}`} in the URL.
                      </FieldDescription>
                      {invalid && (
                        <FieldError
                          errors={field.state.meta.errors.map((error) => ({
                            message: String(error),
                          }))}
                        />
                      )}
                    </Field>
                  )
                }}
              </form.Field>
            ))}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding…" : "Add"}
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function segmentError(value: string) {
  const trimmed = value.trim()
  if (trimmed === "") return "Enter a value."
  if (!SEGMENT.test(trimmed)) {
    return "Use letters, digits, dots, underscores and hyphens, starting and ending with a letter or digit."
  }
  return undefined
}

// organization -> Organization, projectName -> Project name.
function label(name: string) {
  const words = name.replace(/([A-Z])/g, " $1").toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
