import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import MapPage from "./pages/MapPage";
import AdminPage from "./pages/AdminPage";
import EventPage from "./pages/EventPage";
import EventsArchivePage from "./pages/EventsArchivePage";
import LabelArchivePage from "./pages/LabelArchivePage";
import SiteNav from "./components/SiteNav";
import LoginPage from "./pages/LoginPage";
import UserLoginPage from "./pages/UserLoginPage";
import ContentAdminPage from "./pages/ContentAdminPage";

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isEmbedded = new URLSearchParams(location.search).get("embed") === "ios";

  return (
    <>
      {!isEmbedded && <SiteNav />}
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/events" element={<EventsArchivePage />} />
        <Route path="/events/:slug" element={<EventPage />} />
        <Route path="/labels/:username" element={<LabelArchivePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/user-login" element={<UserLoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/posts" element={<ContentAdminPage />} />
      </Routes>
    </>
  );
}
