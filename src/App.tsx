import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MapPage from "./pages/MapPage";
import AdminPage from "./pages/AdminPage";
import EventPage from "./pages/EventPage";
import EventsArchivePage from "./pages/EventsArchivePage";
import LabelArchivePage from "./pages/LabelArchivePage";
import SiteNav from "./components/SiteNav";
import LoginPage from "./pages/LoginPage";

export default function App() {
  return (
    <BrowserRouter>
      <SiteNav />
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/events" element={<EventsArchivePage />} />
        <Route path="/events/:slug" element={<EventPage />} />
        <Route path="/labels/:username" element={<LabelArchivePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
