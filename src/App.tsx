import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MapPage from "./pages/MapPage";
import AdminPage from "./pages/AdminPage";
import EventPage from "./pages/EventPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/events/:slug" element={<EventPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
