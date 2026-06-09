import { redirect } from 'next/navigation'

// The homepage now renders at the root URL. /home remains as a redirect so old
// links keep working without creating duplicate content.
export default function Home() {
  redirect('/')
}
