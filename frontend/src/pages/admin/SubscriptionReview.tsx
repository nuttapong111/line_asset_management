import { TopBar } from '../../components/layout/TopBar'
import { BottomNav } from '../../components/layout/BottomNav'
import PortalSubscriptionsAdmin from '../portal/PortalSubscriptionsAdmin'

/** LIFF mobile page for platform admin to review subscription slips */
export default function SubscriptionReview() {
  return (
    <div className="pb-20">
      <TopBar title="บิลค่าบริการ Owner" />
      <div className="p-4">
        <PortalSubscriptionsAdmin />
      </div>
      <BottomNav role="ADMIN" />
    </div>
  )
}
