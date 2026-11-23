import { useCatalog } from "#/hooks/use-catalog"
import { CatalogCard } from "./catalog-card"

// The pre-installed servers the caller can add (REQ-CONN-080).
export function CatalogSection() {
  const catalog = useCatalog()

  return (
    <section aria-labelledby="catalog-heading" className="flex flex-col gap-4">
      <h2 id="catalog-heading" className="text-lg font-semibold">
        Catalog
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.map((entry) => (
          <CatalogCard key={entry.id} entry={entry} />
        ))}
      </ul>
    </section>
  )
}
