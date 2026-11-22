import { createFileRoute, redirect } from "@tanstack/react-router"

// The servers screen is the start page.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/servers" })
  },
})
