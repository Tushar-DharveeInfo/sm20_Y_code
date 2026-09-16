import { IAppContextWrapper } from "./allinterface/IAppContextWrapper";
import { CommonVariableProvider } from "./contextandprovider/CommonVariable";
import { HelpTipProvider } from "./contextandprovider/Helptip";
import { MainAppProvider } from "./contextandprovider/MainApp";
import { ResourceProvider } from "./contextandprovider/Resource";
import { SelectedNodeProvider } from "./contextandprovider/SelectedNode";
import { SessionProvider } from "./contextandprovider/Session";
import { StatusBarProvider } from "./contextandprovider/StatusBar";
import { SmDataProvider } from "./contextandprovider/SmData";

/* Wraps the app with live context providers in dependency order. */
const AppContextWrapper = ({ children }: IAppContextWrapper) => {
    const providers = [
        MainAppProvider,
        SessionProvider,
        HelpTipProvider,
        StatusBarProvider,
        CommonVariableProvider,
        ResourceProvider,
        SelectedNodeProvider,
        SmDataProvider
    ];

    const wrappedChildren = providers.reduceRight((acc, Comp) => {
        return <Comp>{acc}</Comp>;
    }, children);

    return <>{wrappedChildren}</>;
};

export { AppContextWrapper };
