import { Link, useMatchRoute } from "@tanstack/react-router"
import { DoorOpen, Server } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "#/components/ui/sidebar"

// The screens the sidebar links to, in order.
const SCREENS = [{ to: "/servers", label: "Servers", icon: Server }] as const

// The app's navigation. It collapses to icons on wide screens and opens as a
// sheet on narrow ones.
export function AppSidebar() {
  const matchRoute = useMatchRoute()
  // On narrow screens the sidebar is a sheet; following a link closes it.
  const { setOpenMobile } = useSidebar()
  const close = () => setOpenMobile(false)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/" onClick={close} />}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <DoorOpen className="size-4" aria-hidden />
              </span>
              <span className="font-semibold">OneDoor</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {SCREENS.map((screen) => (
                <SidebarMenuItem key={screen.to}>
                  <SidebarMenuButton
                    render={<Link to={screen.to} onClick={close} />}
                    isActive={Boolean(
                      matchRoute({ to: screen.to, fuzzy: true }),
                    )}
                    tooltip={screen.label}
                  >
                    <screen.icon aria-hidden />
                    <span>{screen.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
