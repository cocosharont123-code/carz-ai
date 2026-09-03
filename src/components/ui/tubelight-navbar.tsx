"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

/**
 * The tubelight nav: a pill of links with a glowing lamp under the active one.
 *
 * Three changes from the component as published, all forced by this codebase
 * rather than preference:
 *
 *  1. The active item follows the URL. As written it kept the active tab in
 *     local state only, which works for the anchor-link demo it ships with but
 *     not here — every link is a real route, so the component unmounts on
 *     navigation and remounts with the state reset to the first item. The lamp
 *     would sit under "Home" on every page. It reads `usePathname` now and
 *     falls back to click state, so anchor-style items still work.
 *
 *  2. The `isMobile` state and its resize listener are gone. Nothing read the
 *     value — the responsive switch between label and icon is done in CSS by
 *     `hidden md:inline` / `md:hidden` — and calling the handler in the effect
 *     body trips this repo's `react-hooks/set-state-in-effect` rule.
 *
 *  3. An empty `items` array no longer throws. `items[0].name` was read
 *     unguarded.
 */
export function NavBar({ items, className }: NavBarProps) {
  const pathname = usePathname()
  const [clicked, setClicked] = useState(items[0]?.name ?? "")

  // Longest match wins, so "/garage/builds" beats "/garage" when both are items.
  const byRoute = items
    .filter((i) => i.url.startsWith("/"))
    .filter((i) => pathname === i.url || pathname.startsWith(`${i.url}/`))
    .sort((a, b) => b.url.length - a.url.length)[0]

  const activeTab = byRoute?.name ?? clicked

  return (
    <div
      className={cn(
        "fixed bottom-0 sm:top-0 left-1/2 -translate-x-1/2 z-50 mb-6 sm:pt-6",
        className,
      )}
    >
      <div className="flex items-center gap-3 bg-background/5 border border-border backdrop-blur-lg py-1 px-1 rounded-full shadow-lg">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.name

          return (
            <Link
              key={item.name}
              href={item.url}
              onClick={() => setClicked(item.name)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative cursor-pointer text-sm font-semibold px-6 py-2 rounded-full transition-colors",
                "text-foreground/80 hover:text-primary",
                isActive && "bg-muted text-primary",
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full bg-primary/5 rounded-full -z-10"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full">
                    <div className="absolute w-12 h-6 bg-primary/20 rounded-full blur-md -top-2 -left-2" />
                    <div className="absolute w-8 h-6 bg-primary/20 rounded-full blur-md -top-1" />
                    <div className="absolute w-4 h-4 bg-primary/20 rounded-full blur-sm top-0 left-2" />
                  </div>
                </motion.div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
