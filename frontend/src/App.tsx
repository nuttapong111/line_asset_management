import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { initLiff, LIFF_ID } from './lib/liff'
import { useAuthStore, Role } from './store/authStore'
import Splash from './pages/Splash'
import PortalApp from './pages/PortalApp'

import LinkRoom from './pages/LinkRoom'
import LinkOwner from './pages/LinkOwner'
import LinkAdmin from './pages/LinkAdmin'
import LinkInvite from './pages/LinkInvite'
import Portfolio from './pages/admin/Portfolio'
import PropertyDetail from './pages/admin/PropertyDetail'
import AddProperty from './pages/admin/AddProperty'
import AddUnit from './pages/admin/AddUnit'
import AddTenant from './pages/admin/AddTenant'
import ContractSetup from './pages/admin/ContractSetup'
import InviteTenant from './pages/admin/InviteTenant'
import MeterRecording from './pages/admin/MeterRecording'
import InvoiceBuilder from './pages/admin/InvoiceBuilder'
import BillingOverview from './pages/admin/BillingOverview'
import SlipReview from './pages/admin/SlipReview'
import ReceiptView from './pages/admin/ReceiptView'
import Reports from './pages/admin/Reports'
import NotifSettings from './pages/admin/NotifSettings'
import Settings from './pages/admin/Settings'
import AdminContractView from './pages/admin/ContractView'
import AdminMaintenanceDetail from './pages/admin/MaintenanceDetail'
import OwnerManage from './pages/admin/OwnerManage'
import SubscriptionPay from './pages/admin/SubscriptionPay'
import SubscriptionReview from './pages/admin/SubscriptionReview'
import DocumentTemplates from './pages/admin/DocumentTemplates'
import DocumentTemplateEditor from './pages/admin/DocumentTemplateEditor'

import TenantHome from './pages/tenant/TenantHome'
import InvoiceDetail from './pages/tenant/InvoiceDetail'
import PaymentSelect from './pages/tenant/PaymentSelect'
import PaymentQR from './pages/tenant/PaymentQR'
import PaymentSuccess from './pages/tenant/PaymentSuccess'
import PaymentHistory from './pages/tenant/PaymentHistory'
import TenantContractView from './pages/tenant/ContractView'
import MaintenanceList from './pages/tenant/MaintenanceList'
import MaintenanceForm from './pages/tenant/MaintenanceForm'
import TenantMaintenanceDetail from './pages/tenant/MaintenanceDetail'
import TenantProfile from './pages/tenant/Profile'
import PdfViewer from './pages/PdfViewer'

function DevRoleSwitcher({ onPick }: { onPick: (r: Role) => void }) {
  if (LIFF_ID) return null
  return (
    <div className="fixed bottom-20 right-3 z-50 flex flex-col gap-1">
      <span className="text-[10px] text-gray-400 text-center">DEV</span>
      <button onClick={() => onPick('ADMIN')} className="bg-gray-800 text-white text-xs px-2 py-1 rounded">Admin</button>
      <button onClick={() => onPick('TENANT')} className="bg-line text-white text-xs px-2 py-1 rounded">Tenant</button>
      <button onClick={() => onPick('OWNER')} className="bg-amber text-white text-xs px-2 py-1 rounded">Owner</button>
    </div>
  )
}

function LiffApp() {
  const { jwt, role, ready, setReady, clearAuth, setAuth } = useAuthStore()
  const [error, setError] = useState<string>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const inviteToken = params.get('token')

  async function boot(mockRole: Role = 'ADMIN') {
    try {
      setReady(false)
      await initLiff(mockRole)
      const s = useAuthStore.getState()
      if (s.jwt && s.role) {
        setAuth(s.jwt, s.role, s.user!, {
          unitId: s.unitId,
          adminId: s.adminId,
          ownerId: s.ownerId,
          mustChangePassword: s.mustChangePassword,
          authSource: 'liff',
        })
      }
    } catch (e) {
      setError((e as Error).message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
      setReady(true)
    }
  }

  useEffect(() => {
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready || !jwt || !inviteToken) return
    if (role === 'NEW') {
      navigate(`/link?token=${inviteToken}`, { replace: true })
      return
    }
    const dest =
      role === 'ADMIN' || role === 'OWNER'
        ? '/admin/portfolio'
        : role === 'TENANT'
        ? '/tenant/home'
        : '/link-room'
    navigate(dest, { replace: true })
  }, [ready, jwt, inviteToken, role, navigate])

  function switchRole(r: Role) {
    clearAuth()
    boot(r)
  }

  if (!ready) return <Splash />
  if (error && !jwt) return <Splash error={error} />

  const home =
    role === 'ADMIN' || role === 'OWNER'
      ? '/admin/portfolio'
      : role === 'TENANT'
      ? '/tenant/home'
      : '/link-room'

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f5f6f8]">
      <Routes>
        <Route path="/" element={<Navigate to={home} replace />} />
        <Route path="/link" element={<LinkInvite />} />
        <Route path="/link-room" element={<LinkRoom />} />
        <Route path="/link-owner" element={<LinkOwner />} />
        <Route path="/link-admin" element={<LinkAdmin />} />

        <Route path="/admin/portfolio" element={<Portfolio />} />
        <Route path="/admin/property/:id" element={<PropertyDetail />} />
        <Route path="/admin/property/new" element={<AddProperty />} />
        <Route path="/admin/property/:id/unit/new" element={<AddUnit />} />
        <Route path="/admin/property/:id/tenant/new" element={<AddTenant />} />
        <Route path="/admin/tenant/:tenantId/contract" element={<ContractSetup />} />
        <Route path="/admin/tenant/:tenantId/invite" element={<InviteTenant />} />
        <Route path="/admin/property/:id/meter" element={<MeterRecording />} />
        <Route path="/admin/invoice-builder" element={<InvoiceBuilder />} />
        <Route path="/admin/billing" element={<BillingOverview />} />
        <Route path="/admin/slip/:paymentId" element={<SlipReview />} />
        <Route path="/admin/receipt/:paymentId" element={<ReceiptView />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/notifications" element={<NotifSettings />} />
        <Route path="/admin/settings" element={<Settings />} />
        <Route path="/admin/contract/:id" element={<AdminContractView />} />
        <Route path="/admin/maintenance/:id" element={<AdminMaintenanceDetail />} />
        <Route path="/admin/owners" element={<OwnerManage />} />
        <Route path="/admin/subscription" element={<SubscriptionPay />} />
        <Route path="/admin/subscriptions" element={<SubscriptionReview />} />
        <Route path="/admin/document-templates" element={<DocumentTemplates />} />
        <Route path="/admin/document-templates/new" element={<DocumentTemplateEditor />} />
        <Route path="/admin/document-templates/:id" element={<DocumentTemplateEditor />} />

        <Route path="/owner/home" element={<Navigate to="/admin/portfolio" replace />} />

        <Route path="/tenant/home" element={<TenantHome />} />
        <Route path="/invoice" element={<TenantHome />} />
        <Route path="/payment" element={<TenantHome />} />
        <Route path="/receipt" element={<PaymentHistory />} />
        <Route path="/contact" element={<TenantProfile />} />
        <Route path="/tenant/invoice/:id" element={<InvoiceDetail />} />
        <Route path="/payment/:invoiceId" element={<PaymentSelect />} />
        <Route path="/payment/:invoiceId/qr" element={<PaymentQR />} />
        <Route path="/payment/:invoiceId/success" element={<PaymentSuccess />} />
        <Route path="/tenant/history" element={<PaymentHistory />} />
        <Route path="/contract" element={<TenantContractView />} />
        <Route path="/contract/:id" element={<TenantContractView />} />
        <Route path="/tenant/maintenance" element={<MaintenanceList />} />
        <Route path="/maintenance/new" element={<MaintenanceForm />} />
        <Route path="/tenant/maintenance/new" element={<MaintenanceForm />} />
        <Route path="/tenant/maintenance/:id" element={<TenantMaintenanceDetail />} />
        <Route path="/tenant/profile" element={<TenantProfile />} />

        <Route path="/pdf-viewer" element={<PdfViewer />} />

        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
      <DevRoleSwitcher onPick={switchRole} />
    </div>
  )
}

export default function App() {
  const { pathname } = useLocation()
  if (pathname.startsWith('/portal')) {
    return <PortalApp />
  }
  return <LiffApp />
}
