import { lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppLayout from "./components/layout/AppLayout";
import { SportProvider } from "./contexts/SportContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PinsProvider } from "./contexts/PinsContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import { ToastProvider } from "./contexts/ToastContext";

const TodayPage = lazy(() => import("./pages/TodayPage"));
const ScoreboardPage = lazy(() => import("./pages/ScoreboardPage"));
const StandingsPage = lazy(() => import("./pages/StandingsPage"));
const TeamsPage = lazy(() => import("./pages/TeamsPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const PlayerPage = lazy(() => import("./pages/PlayerPage"));
const GamePage = lazy(() => import("./pages/GamePage"));
const LeadersPage = lazy(() => import("./pages/LeadersPage"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const DraftPage = lazy(() => import("./pages/DraftPage"));
const ExplorerPage = lazy(() => import("./pages/ExplorerPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const FavoritesPage = lazy(() => import("./pages/FavoritesPage"));
const StreaksPage = lazy(() => import("./pages/StreaksPage"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));
const AwardsPage = lazy(() => import("./pages/AwardsPage"));
const VenuesPage = lazy(() => import("./pages/VenuesPage"));
const VenuePage = lazy(() => import("./pages/VenuePage"));
const TeamComparePage = lazy(() => import("./pages/TeamComparePage"));
const PostseasonPage = lazy(() => import("./pages/PostseasonPage"));
const GlossaryPage = lazy(() => import("./pages/GlossaryPage"));
const DiamondGptPage = lazy(() => import("./pages/DiamondGptPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <FavoritesProvider>
          <PinsProvider>
            <ToastProvider>
              <NotificationsProvider>
                <SportProvider>
              <BrowserRouter>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route index element={<TodayPage />} />
                    <Route path="scoreboard" element={<ScoreboardPage />} />
                    <Route path="standings" element={<StandingsPage />} />
                    <Route path="teams" element={<TeamsPage />} />
                    <Route path="teams/:teamId" element={<TeamPage />} />
                    <Route path="players/:personId" element={<PlayerPage />} />
                    <Route path="game/:gamePk" element={<GamePage />} />
                    <Route path="leaders" element={<LeadersPage />} />
                    <Route path="streaks" element={<StreaksPage />} />
                    <Route path="compare" element={<ComparePage />} />
                    <Route path="team-compare" element={<TeamComparePage />} />
                    <Route path="postseason" element={<PostseasonPage />} />
                    <Route path="history" element={<HistoryPage />} />
                    <Route path="draft" element={<DraftPage />} />
                    <Route path="awards" element={<AwardsPage />} />
                    <Route path="transactions" element={<TransactionsPage />} />
                    <Route path="venues" element={<VenuesPage />} />
                    <Route path="venues/:venueId" element={<VenuePage />} />
                    <Route path="favorites" element={<FavoritesPage />} />
                    <Route path="glossary" element={<GlossaryPage />} />
                    <Route path="explorer" element={<ExplorerPage />} />
                    <Route path="search" element={<SearchPage />} />
                    <Route path="diamondgpt" element={<DiamondGptPage />} />
                    <Route path="about" element={<AboutPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </BrowserRouter>
                </SportProvider>
              </NotificationsProvider>
            </ToastProvider>
          </PinsProvider>
        </FavoritesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
