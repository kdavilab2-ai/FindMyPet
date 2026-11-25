import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

const CatalogosContext = createContext(null);

export function CatalogosProvider({ children }) {
  const [catalogos, setCatalogos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/catalogos').then(setCatalogos).catch((e) => setError(e.message));
  }, []);

  return <CatalogosContext.Provider value={{ catalogos, error }}>{children}</CatalogosContext.Provider>;
}

export const useCatalogos = () => useContext(CatalogosContext);
