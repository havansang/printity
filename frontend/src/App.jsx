import AppRouter from './app/AppRouter';
import './app/app.css';
import { AuthProvider } from './features/auth/AuthContext';
import { LanguageProvider } from './features/language/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
