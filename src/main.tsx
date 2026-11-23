import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PagesPreview} from './pages/public/PagesPreview.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  import.meta.env.MODE === 'pages' ? <PagesPreview /> : <App />,
);
