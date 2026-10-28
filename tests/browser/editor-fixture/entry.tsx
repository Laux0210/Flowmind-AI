import React from 'react';
import { createRoot } from 'react-dom/client';
import Editor from '../../../apps/web/src/app/workflows/[id]/page';

createRoot(document.getElementById('root')!).render(<React.StrictMode><Editor /></React.StrictMode>);
