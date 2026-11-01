import { useParams } from 'react-router-dom'
import PayFlow from './PayFlow'

/** /payment/:invoiceId/qr uses the same pay screen as /payment/:invoiceId */
export default function PaymentQR() {
  const { invoiceId } = useParams()
  return <PayFlow invoiceId={invoiceId} />
}
