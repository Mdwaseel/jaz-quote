import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getCookie } from './utils/cookies';
import { isAdmin } from './utils/roles';

import MainLayout from './layout/MainLayout';
import MinimalLayout from './layout/MinimalLayout';
import AdminLayout from './layout/AdminLayout';

import Login from './views/auth/Login';
import ForgotPassword from './views/auth/ForgotPassword';
import CheckMail from './views/auth/CheckMail';
import ResetPassword from './views/auth/ResetPassword';

import SalesDashboard from './views/dashboard/SalesDashboard';
import CreateQuote from './views/quotation/CreateQuote';
import QuotationList from './views/quotation/QuotationList';
import QuoteView from './views/quotation/QuoteView';
import Approvals from './views/approvals/Approvals';
import MyTeam from './views/team/MyTeam';
import Notifications from './views/notifications/Notifications';
import DealAnalysis from './views/deals/DealAnalysis';
import PublicSign from './views/esign/PublicSign';
import ProfileView from './views/user-profile/ProfileView';
import ListOfProfile from './views/user-profile/ListOfProfile';
import ListOfBranches from './views/user-profile/ListOfBranches';

import AdminLogin from './views/admin/AdminLogin';
import AdminDashboard from './views/admin/AdminDashboard';
import PriceManager from './views/admin/PriceManager';
import AdminQuotations from './views/admin/AdminQuotations';
import AdminUsers from './views/admin/AdminUsers';
import AdminAudit from './views/admin/AdminAudit';
import CompanySettings from './views/admin/CompanySettings';

const RequireAuth = ({ children }) => {
  const isLoggedIn = useSelector((s) => s.auth.isLoggedIn) || !!getCookie('serviceToken');
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const RedirectIfAuthed = ({ children }) => {
  const isLoggedIn = useSelector((s) => s.auth.isLoggedIn) || !!getCookie('serviceToken');
  return isLoggedIn ? <Navigate to="/sales-dashboard" replace /> : children;
};

const RequireAdmin = ({ children }) => {
  const isLoggedIn = useSelector((s) => s.auth.isLoggedIn) || !!getCookie('serviceToken');
  const user = useSelector((s) => s.auth.user);
  if (!isLoggedIn) return <Navigate to="/admin/login" replace />;
  if (!isAdmin(user)) return <Navigate to="/admin/login" replace />;
  return children;
};

export default function App() {
  return (
    <Routes>
      {/* Auth */}
      <Route
        element={
          <RedirectIfAuthed>
            <MinimalLayout />
          </RedirectIfAuthed>
        }
      >
        <Route path="/login" element={<Login />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/check-mail" element={<CheckMail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Customer e-signature (public link, no login) */}
      <Route path="/sign/:token" element={<PublicSign />} />

      {/* Admin */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/prices" element={<PriceManager />} />
        <Route path="/admin/quotations" element={<AdminQuotations />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/approvals" element={<Approvals adminMode />} />
        <Route path="/admin/org" element={<Navigate to="/admin/users" replace />} />
        <Route path="/admin/audit" element={<AdminAudit />} />
        <Route path="/admin/company" element={<CompanySettings />} />
      </Route>

      {/* Sales app */}
      <Route
        element={
          <RequireAuth>
            <MainLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/sales-dashboard" replace />} />
        <Route path="/sales-dashboard" element={<SalesDashboard />} />
        <Route path="/quotation/create" element={<CreateQuote />} />
        <Route path="/quotation/list" element={<QuotationList />} />
        <Route path="/quotation/view/:number" element={<QuoteView />} />
        <Route path="/quotation/edit/:number" element={<CreateQuote />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/team" element={<MyTeam />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/deals" element={<DealAnalysis />} />
        <Route path="/user-profile/profile-view" element={<ProfileView />} />
        <Route path="/user-profile/list-of-profile" element={<ListOfProfile />} />
        <Route path="/user-profile/list-of-branches" element={<ListOfBranches />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
