import CrudDemo from './components/CrudDemo';

export default function App() {
  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'6px 14px', background:'#1a1a2e', color:'#fff', fontSize:13, display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <strong>Gestor de Parqueo</strong>
        <span style={{ color:'#888' }}>— Demo CRUD · Grupo 8</span>
      </div>
      <div style={{ flex:1, overflow:'hidden' }}>
        <CrudDemo />
      </div>
    </div>
  );
}
