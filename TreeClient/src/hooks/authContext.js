import { createContext, useContext } from 'react';

// The context and its hook live in their own module so that useAuth.jsx only
// exports a React component. Mixing component and non-component exports in one
// file breaks React Fast Refresh (eslint react-refresh/only-export-components).
export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);
