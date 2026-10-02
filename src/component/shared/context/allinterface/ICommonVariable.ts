interface ISessionVars {
    diagnosticLevel: string;
    basicRole: string;
}

interface ICommonVariable {
    sidebarWidth: number;
    selectedNodeMenu: any;
    diagnosticLevel?: string;
    reloadTreeFor?: { featureId: string, entId: string, dropNodeEntId?: string, timestamp?: number };
    sessionVarsForTreeNode?: ISessionVars;
    setSidebarWidth: (width: number) => void;
    setSelectedNodeMenu: (data: any) => void;
    setReloadTreeFor: (data?: { featureId: string, entId: string, dropNodeEntId?: string, timestamp?: number }) => void;
    setDiagnosticLevel: (diagnosticLevel?: string) => void;
    setSessionVarsForTreeNode: (sessionVarsForTreeNode?: ISessionVars) => void;
}

export type { ICommonVariable, ISessionVars };