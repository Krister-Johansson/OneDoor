import { Badge } from "#/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card"
import { Switch } from "#/components/ui/switch"
import { useCatalog } from "#/hooks/use-catalog"

// The pre-installed servers the caller can switch on (REQ-CONN-080).
export function CatalogSection() {
  const catalog = useCatalog()

  return (
    <section aria-labelledby="catalog-heading" className="flex flex-col gap-4">
      <h2 id="catalog-heading" className="text-lg font-semibold">
        Catalog
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.map((entry) => (
          <Card key={entry.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <img
                  src={entry.iconUrl}
                  alt=""
                  className="size-8 shrink-0 rounded-sm"
                />
                <CardTitle>{entry.displayName}</CardTitle>
              </div>
              <CardDescription>{entry.description}</CardDescription>
              <CardAction>
                <Switch
                  checked={entry.connection?.enabled ?? false}
                  disabled
                  aria-label={`Use ${entry.displayName}`}
                />
              </CardAction>
              {entry.connection?.setupState === "NEEDS_CREDENTIALS" && (
                <Badge variant="outline">Needs credentials</Badge>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  )
}
