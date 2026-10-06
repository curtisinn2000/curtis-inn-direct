import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import HomePage from "./pages/HomePage";
import RoomsPage from "./pages/RoomsPage";
import RoomDetailPage from "./pages/RoomDetailPage";
import GalleryPage from "./pages/GalleryPage";
import LocationPage from "./pages/LocationPage";
import FAQPage from "./pages/FAQPage";
import PoliciesPage from "./pages/PoliciesPage";
import ContactPage from "./pages/ContactPage";
import BookingPage from "./pages/BookingPage";
import CheckoutPage from "./pages/CheckoutPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminReservationsPage from "./pages/admin/AdminReservationsPage";
import AdminReservationDetailPage from "./pages/admin/AdminReservationDetailPage";
import AdminCalendarPage from "./pages/admin/AdminCalendarPage";
import AdminRoomTypesPage from "./pages/admin/AdminRoomTypesPage";
import AdminRoomTypeEditorPage from "./pages/admin/AdminRoomTypeEditorPage";
import AdminRatesPage from "./pages/admin/AdminRatesPage";
import AdminPaymentsPage from "./pages/admin/AdminPaymentsPage";
import AdminContentPage from "./pages/admin/AdminContentPage";
import AdminReportsPage from "./pages/admin/AdminReportsPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminInvitationPage from "./pages/admin/AdminInvitationPage";
import { RequireAdminPermission } from "./components/admin/RequireAdminPermission";
import { ADMIN_PERMISSIONS } from "./config/adminPermissions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/room/:slug" element={<RoomDetailPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/location" element={<LocationPage />} />
            <Route path="/faq" element={<FAQPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/booking/checkout" element={<CheckoutPage />} />
            <Route path="/booking/confirmation" element={<ConfirmationPage />} />
          </Route>

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/invite/:token" element={<AdminInvitationPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<RequireAdminPermission permission={ADMIN_PERMISSIONS.dashboardRead}><AdminDashboard /></RequireAdminPermission>} />
            <Route path="reservations" element={<RequireAdminPermission permission={ADMIN_PERMISSIONS.reservationsRead}><AdminReservationsPage /></RequireAdminPermission>} />
            <Route path="reservations/:id" element={<RequireAdminPermission permission={ADMIN_PERMISSIONS.reservationsRead}><AdminReservationDetailPage /></RequireAdminPermission>} />
            <Route path="calendar" element={<RequireAdminPermission permission={ADMIN_PERMISSIONS.availabilityRead}><AdminCalendarPage /></RequireAdminPermission>} />
            <Route path="rooms" element={<Navigate to="/admin/room-types" replace />} />
            <Route path="room-types" element={<RequireAdminPermission permission={ADMIN_PERMISSIONS.roomsRead}><AdminRoomTypesPage /></RequireAdminPermission>} />
            <Route path="room-types/new" element={<RequireAdminPermission permission={ADMIN_PERMISSIONS.roomsManage}><AdminRoomTypeEditorPage /></RequireAdminPermission>} />
            <Route path="room-types/:id/edit" element={<RequireAdminPermission permission={ADMIN_PERMISSIONS.roomsManage}><AdminRoomTypeEditorPage /></RequireAdminPermission>} />
            <Route path="rates" element={<RequireAdminPermission permission={ADMIN_PERMISSIONS.ratesRead}><AdminRatesPage /></RequireAdminPermission>} />
            <Route path="payments" element={<RequireAdminPermission permission={ADMIN_PERMISSIONS.paymentsRead}><AdminPaymentsPage /></RequireAdminPermission>} />
            <Route path="content" element={<RequireAdminPermission permission={ADMIN_PERMISSIONS.contentRead}><AdminContentPage /></RequireAdminPermission>} />
            <Route path="reports" element={<RequireAdminPermission permission={ADMIN_PERMISSIONS.reportsRead}><AdminReportsPage /></RequireAdminPermission>} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
