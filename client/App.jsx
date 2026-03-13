import { useTheme } from './hooks/useTheme';
import Header from './components/Header';
import CrudDemo from './components/CrudDemo';

export default function App() {
  const { tema, setTema } = useTheme();

  const toggleTema = () =>
    setTema((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <div className="app">
      <Header tema={tema} onToggleTema={toggleTema} />
      <main className="main">
        <CrudDemo />
      </main>
      <footer className="footer">
        <p>Gestor de Parqueo — Grupo 8 · Análisis de Sistemas I</p>
      </footer>
    </div>
  );
}
