import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import {
  CalendarDays, Trophy, Shield, Flame, TerminalSquare, Search,
  Activity, Home, GitCompare, History, Layers, Star, Sun, Moon,
  Eye, X, Award, ArrowLeftRight, MapPin, Keyboard, Zap, Crown,
  Users, BookOpen, LayoutGrid, Sparkles,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Suspense, useEffect, useState } from "react";
import { useSport } from "../../contexts/SportContext";
import SportPicker from "./SportPicker";
import { useFavorites } from "../../contexts/FavoritesContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Spinner } from "../ui/Primitives";
import ErrorBoundary from "../ui/ErrorBoundary";
import CommandPalette from "./CommandPalette";
import ShortcutsHelp from "./ShortcutsHelp";
import { useShortcuts } from "../../hooks/useShortcuts";
import { useQueryClient } from "@tanstack/react-query";
import { todayIso } from "../../lib/utils";
import ToastViewport from "../ui/ToastViewport";
import { useNotificationPoller } from "../../hooks/useNotificationPoller";
import NotificationsBell from "./NotificationsBell";

const MAIN_NAV = [
  { to: "/",            label: "Today",      icon: Home,        end: true  },
  { to: "/scoreboard",  label: "Scoreboard", icon: CalendarDays            },
  { to: "/standings",   label: "Standings",  icon: Trophy                  },
  { to: "/teams",       label: "Teams",      icon: Shield                  },
  { to: "/leaders",     label: "Leaders",    icon: Flame                   },
  { to: "/streaks",     label: "Streaks",    icon: Zap                     },
];

const EXPLORE_NAV = [
  { to: "/diamondgpt",   label: "DiamondGPT",      icon: Sparkles       },
  { to: "/compare",      label: "Compare Players", icon: GitCompare     },
  { to: "/team-compare", label: "Compare Teams",   icon: Users          },
  { to: "/postseason",   label: "Postseason",      icon: Crown          },
  { to: "/history",      label: "History",         icon: History        },
  { to: "/awards",       label: "Awards",          icon: Award          },
  { to: "/transactions", label: "Transactions",    icon: ArrowLeftRight  },
  { to: "/venues",       label: "Ballparks",       icon: MapPin         },
  { to: "/draft",        label: "Draft",           icon: Layers         },
  { to: "/glossary",     label: "Glossary",        icon: BookOpen       },
  { to: "/explorer",     label: "API Explorer",    icon: TerminalSquare },
];

const BOTTOM_TABS = [
  { to: "/",           label: "Today",     icon: Home,        end: true  },
  { to: "/scoreboard", label: "Scores",    icon: CalendarDays             },
  { to: "/standings",  label: "Standings", icon: Trophy                   },
  { to: "/search",     label: "Search",    icon: Search                   },
];

function useLiveCount(sportId: number) {
  const qc = useQueryClient();
  const date = todayIso();
  const data = qc.getQueryData<any>(["schedule", sportId, date]);
  const games = (data?.dates?.[0]?.games ?? []) as any[];
  return games.filter((g) => g.status?.abstractGameState === "Live").length;
}

export default function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { helpOpen, setHelpOpen } = useShortcuts();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const location = useLocation();
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  return (
    <div className="flex h-full bg-pitch-950 overflow-hidden diamond-app-root">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-[200px] shrink-0 flex-col border-r border-white/[0.05] bg-pitch-950 diamond-chrome">
        <SidebarContent
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
        />
      </aside>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-[75%] max-w-[280px] flex flex-col",
          "bg-pitch-950 border-r border-white/[0.05] diamond-chrome",
          "transform transition-transform duration-200 ease-out lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent
          onOpenPalette={() => { setPaletteOpen(true); setDrawerOpen(false); }}
          onOpenHelp={() => { setHelpOpen(true); setDrawerOpen(false); }}
          onClose={() => setDrawerOpen(false)}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden h-[52px] flex items-center justify-between px-4 border-b border-white/[0.05] bg-pitch-950 shrink-0 diamond-chrome">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-volt-500">
              <Activity size={13} className="text-black" />
            </div>
            <span className="font-display font-black text-sm uppercase tracking-widest text-white">
              Diamond
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="btn p-2"
              title="Search ⌘K"
            >
              <Search size={14} />
            </button>
            <NotificationsBell />
            <button
              onClick={() => setDrawerOpen(true)}
              className="btn p-2"
              title="Menu"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8 lg:pb-8">
            <ErrorBoundary>
              <Suspense fallback={
                <div className="flex items-center justify-center py-20">
                  <Spinner />
                </div>
              }>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="lg:hidden shrink-0 flex h-[60px] items-stretch border-t border-white/[0.05] bg-pitch-950 diamond-chrome">
          {BOTTOM_TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5",
                  "font-display font-bold text-[9px] tracking-[0.1em] uppercase transition-colors",
                  isActive ? "text-volt-500" : "text-white/30"
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 font-display font-bold text-[9px] tracking-[0.1em] uppercase text-white/30 hover:text-white/60 transition-colors"
          >
            <LayoutGrid size={18} />
            More
          </button>
        </nav>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <NotificationsRunner />
      <ToastViewport />
    </div>
  );
}

function NotificationsRunner() {
  useNotificationPoller();
  return null;
}

function SidebarContent({
  onOpenPalette,
  onOpenHelp,
  onClose,
}: {
  onOpenPalette: () => void;
  onOpenHelp: () => void;
  onClose?: () => void;
}) {
  const { sport, sportId } = useSport();
  const { favs } = useFavorites();
  const { theme, toggle, cbSafe, toggleCb } = useTheme();
  const liveCount = useLiveCount(sportId);

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.05] diamond-chrome-inner">
        <Link to="/" className="flex items-center gap-2.5 min-w-0" onClick={onClose}>
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-volt-500 shrink-0">
            <Activity size={13} className="text-black" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-black text-[13px] uppercase tracking-widest text-white leading-none">
              Diamond
            </div>
            <div className="sidebar-sub font-display font-bold text-[8px] tracking-[0.2em] uppercase text-white/25 leading-none mt-0.5">
              {sport.abbreviation} · Stats
            </div>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-white/25 hover:text-white/60 ml-2 shrink-0">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Search shortcut */}
      <div className="px-3 py-2 border-b border-white/[0.04] diamond-chrome-inner">
        <button
          onClick={onOpenPalette}
          className="sidebar-search-btn w-full flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] px-3 py-1.5 text-white/30 hover:text-white/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search size={11} />
            <span className="font-display font-bold text-[11px] tracking-wider uppercase">
              Search
            </span>
          </div>
          <kbd className="font-display font-bold text-[9px] tracking-[0.05em] text-white/20 bg-white/[0.04] border border-white/[0.06] rounded px-1.5 py-0.5">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2">
        <NavGroup label="Main">
          {MAIN_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) => cn("nav-item", isActive && "nav-item-active")}
            >
              <Icon size={14} />
              <span className="flex-1 min-w-0 truncate">{label}</span>
              {label === "Today" && liveCount > 0 && (
                <span className="ml-auto bg-volt-500 text-black rounded-full px-1.5 font-display font-black text-[9px] tracking-wider shrink-0">
                  {liveCount}
                </span>
              )}
            </NavLink>
          ))}
          <NavLink
            to="/favorites"
            onClick={onClose}
            className={({ isActive }) => cn("nav-item", isActive && "nav-item-active")}
          >
            <Star size={14} />
            <span className="flex-1 min-w-0 truncate">Favorites</span>
            {favs.length > 0 && (
              <span className="ml-auto font-mono text-[10px] text-white/25 shrink-0">
                {favs.length}
              </span>
            )}
          </NavLink>
        </NavGroup>

        <NavGroup label="Explore">
          {EXPLORE_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => cn("nav-item", isActive && "nav-item-active")}
            >
              <Icon size={14} />
              <span className="min-w-0 truncate">{label}</span>
            </NavLink>
          ))}
        </NavGroup>
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.05] p-3 flex items-center justify-between gap-2 diamond-chrome-inner">
        <SportPicker />
        <div className="flex items-center gap-1">
          <button
            onClick={toggleCb}
            className={cn("btn p-1.5", cbSafe && "bg-volt-500/[0.12] border-volt-500/30 text-volt-500")}
            title={cbSafe ? "Color-blind safe: ON" : "Color-blind safe: OFF"}
          >
            <Eye size={12} />
          </button>
          <button onClick={onOpenHelp} className="btn p-1.5" title="Keyboard shortcuts">
            <Keyboard size={12} />
          </button>
          <button
            onClick={toggle}
            className="btn p-1.5"
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
          </button>
          <NotificationsBell placement="top" />
        </div>
      </div>
    </>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-5 py-1.5 font-display font-bold text-[9px] tracking-[0.22em] uppercase text-white/20">
        {label}
      </div>
      {children}
    </div>
  );
}
