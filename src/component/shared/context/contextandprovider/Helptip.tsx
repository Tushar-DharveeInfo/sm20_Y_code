/*
instead importing context  
import { HelpTipContext } from './contextandprovider/Helptip';
you should import hook and use the hook to consume the context like below
import { useHelpTip } from './contextandprovider/Helptip';
*/

import { createContext, useMemo, useState } from "react";
import { IHelpTip, IHelpTipProperty } from "../allinterface/IHelpTip";
import { IAppContextWrapper } from "../allinterface/IAppContextWrapper";
import { useLoadRemoteJson } from "../../allcommon/LoadRemoteJsonHooks";

// Create a context with default values
const HelpTipContext = createContext<IHelpTip | undefined>(undefined);

function HelpTipProvider({ children }: IAppContextWrapper) {
    const [helpTipRecords, setHelpTipRecords] = useState<IHelpTipProperty[]>([]);
    const [error, setError] = useState<string | null>(null);

    useLoadRemoteJson({ bucket:'n20-bucket-01', baseFolder:'sm', fileName:'help/helptips-sm.json', onSuccess:setHelpTipRecords, onError:setError })

    const contextValue: IHelpTip = useMemo(() => ({
        helpTipRecords,
        setHelpTipRecords,
        error
    }), [helpTipRecords, error]);

    return (
        <HelpTipContext.Provider value={contextValue}>
            {children}
        </HelpTipContext.Provider>
    );
}

export { HelpTipContext, HelpTipProvider };
