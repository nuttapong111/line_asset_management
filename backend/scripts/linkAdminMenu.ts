import { setAdminRichMenu } from '../src/lib/line/richMenu'

const USER = process.argv[2] || 'U9cec0af055fdda9cd145a176518ae3f5'
;(async () => {
  await setAdminRichMenu(USER)
  console.log('linked admin menu to', USER)
  process.exit(0)
})()
