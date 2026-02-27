import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import ProductDetail from "./pages/ProductDetail";
import SavedPage from "./pages/SavedPage";
import AccountPage from "./pages/AccountPage";
import ReportPage from "./pages/ReportPage";
import AuthPage from "./pages/AuthPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/p/:productId" element={<ProductDetail />} />
        <Route path="/saved" element={
          <ProtectedRoute><SavedPage /></ProtectedRoute>
        } />
        <Route path="/account" element={
          <ProtectedRoute><AccountPage /></ProtectedRoute>
        } />
        <Route path="/report/:reportId" element={
          <ProtectedRoute><ReportPage /></ProtectedRoute>
        } />
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
      <Toaster />
    </>
  );
}
