import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import PasswordLoginPage from "./pages/PasswordLoginPage";
import GestureSetupPage from "./pages/GestureSetupPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";
import NotesPage from "./pages/NotesPage";
import NoteEditorPage from "./pages/NoteEditorPage";
import TasksPage from "./pages/TasksPage";
import AiAssistantPage from "./pages/AiAssistantPage";
import ActivityPage from "./pages/ActivityPage";
import NotificationsPage from "./pages/NotificationsPage";
import BottomNav from "./pages/components/BottomNav";
import RequireAuth from "./pages/components/RequireAuth";
import AuthEventHandler from "./pages/components/AuthEventHandler";

const NAV_ROUTES = [
  "/dashboard",
  "/notes",
  "/tasks",
  "/ai",
  "/profile",
  "/activity",
  "/notifications",
];

function Layout() {
  const { pathname } = useLocation();
  const showNav = NAV_ROUTES.includes(pathname);

  return (
    <>
      {/* Reacts to 401/403/5xx events emitted by lib/api.ts — see AuthEventHandler.tsx */}
      <AuthEventHandler />

      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login/password" element={<PasswordLoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/gesture-setup"
          element={
            <RequireAuth>
              <GestureSetupPage />
            </RequireAuth>
          }
        />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/notes"
          element={
            <RequireAuth>
              <NotesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/notes/new"
          element={
            <RequireAuth>
              <NoteEditorPage />
            </RequireAuth>
          }
        />
        <Route
          path="/notes/:id"
          element={
            <RequireAuth>
              <NoteEditorPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tasks"
          element={
            <RequireAuth>
              <TasksPage />
            </RequireAuth>
          }
        />
        <Route
          path="/ai"
          element={
            <RequireAuth>
              <AiAssistantPage />
            </RequireAuth>
          }
        />
        <Route
          path="/activity"
          element={
            <RequireAuth>
              <ActivityPage />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showNav && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
