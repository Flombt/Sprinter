import { createContext, useContext } from 'react';

/** Measured navigation clearance. Sheets/subpages outside this provider get no dock inset. */
export const BottomBarInsetContext = createContext(0);
export const useBottomBarInset = () => useContext(BottomBarInsetContext);
