import { useState } from "react";
import HDBContext from "./HDBContext.jsx";

/**
 * Context provider that supplies global state for filtered HDB listings
 * using React's useState. Allows access to filteredHdbs and setFilteredHdbs
 * throughout the component tree via HDBContext.
 *
 * @author Jia Yang
 */
const HDBProvider = ({ children }) => {
  const [filteredHdbs, setFilteredHdbs] = useState([]);

  return (
    <HDBContext.Provider value={{ filteredHdbs, setFilteredHdbs }}>
      {children}
    </HDBContext.Provider>
  );
};

export default HDBProvider;
