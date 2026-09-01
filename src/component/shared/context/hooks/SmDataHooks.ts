import { useContext } from "react";
import { SmDataContext } from "../contextandprovider/SmData";

const useSmDataContext = () => {
    const context = useContext(SmDataContext);
    if (context === undefined) {
        throw new Error("useSmDataContext must be used within a SmDataProvider");
    }
    return context;
};

export { useSmDataContext };
