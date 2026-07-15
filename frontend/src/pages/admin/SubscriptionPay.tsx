import { TopBar } from '../../components/layout/TopBar'
import { BottomNav } from '../../components/layout/BottomNav'
import PortalSubscription from '../portal/PortalSubscription'

/** LIFF mobile page for owner SaaS payment */
export default function SubscriptionPay() {
  return (
    <div className="pb-20">
      <TopBar title="ค่าบริการ PropFlow" />
      <div className="p-4">
        <PortalSubscription />
      </div>
      <BottomNav role="ADMIN" />
    </div>
  )
}
