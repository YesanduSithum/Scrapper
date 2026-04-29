import { AuthProvider } from './context/AuthContext'
import Home from './Home'

export default function App() {
  return (
    <AuthProvider>
      <Home />
    </AuthProvider>
  )
}
