import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import Home from "./pages/Home";
import Library60 from "./pages/Library60";
import LibraryDetail from "./pages/LibraryDetail";
import Learn from "./pages/Learn";

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/library" element={<Library60 />} />
        <Route path="/library/:key" element={<LibraryDetail />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}