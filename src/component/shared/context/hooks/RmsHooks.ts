import { useContext } from "react";
import { RmsContext } from "../contextandprovider/Rms";

const useRmsContext = () => {
    const context = useContext(RmsContext);
    if (context === undefined) {
        throw new Error("useRmsContext must be used within a RmsProvider");
    }
    return context;
};

export { useRmsContext };
