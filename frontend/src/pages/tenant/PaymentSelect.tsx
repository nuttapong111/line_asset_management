import { useParams } from 'react-router-dom'
import PayFlow from './PayFlow'

export default function PaymentSelect() {
  const { invoiceId } = useParams()
  return <PayFlow invoiceId={invoiceId} />
}
