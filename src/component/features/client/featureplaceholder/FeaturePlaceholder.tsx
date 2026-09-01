import { useMainAppContext } from "../../../shared/context/hooks/MainAppHooks";
import "./FeaturePlaceholder.css";

interface IFeaturePlaceholder {
    uniqueName: string;
    featureId: string;
    featureName?: string;
    message?: string;
}

const FeaturePlaceholder = (props: IFeaturePlaceholder) => {
    const mainAppContext = useMainAppContext();
    const featureRecord = mainAppContext.featureRecords.find(
        (item) => String(item._Feature) === String(props.featureId)
    );
    const label = featureRecord?.Label || props.featureName || props.featureId;

    return (
        <div
            key={props.uniqueName}
            className="nz-feature-placeholder nz-wh-100"
            data-feature-id={props.featureId}
        >
            <div className="nz-feature-placeholder-name">{label}</div>
            {props.message ? (
                <div className="nz-feature-placeholder-message">{props.message}</div>
            ) : null}
        </div>
    );
};

export { FeaturePlaceholder };
export type { IFeaturePlaceholder };
