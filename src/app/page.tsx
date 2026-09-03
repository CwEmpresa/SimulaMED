import { redirect } from 'next/navigation'

export default function Home() {
  // O middleware já decide entre /login e /dashboard conforme a sessão.
  redirect('/dashboard')
}
