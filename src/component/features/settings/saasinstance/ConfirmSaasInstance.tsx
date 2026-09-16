
import { YesNoForm } from '@n20a/libform'

interface ISaasInstanceProfile {
    tenantshortname: string
    userid: string
    onYesClick?: (data: {
      tenantshortname: string
      userid: string
    }) => void
}

const ConfirmSaasInstance = ({ tenantshortname, userid, onYesClick }: ISaasInstanceProfile) => {

    const handleYes = () => {
        console.log("tenantshortname", tenantshortname)
        console.log("userid", userid)
        if (onYesClick) {
            onYesClick({ tenantshortname, userid })
        }
    }

    const YesNoFormProps = {
        title: "Create SAAS Instance",
        message: `Ready to Create a new SAAS Instance for ${tenantshortname} ?`,
        buttonLabels: ["Yes"],
        onButtonClick: handleYes
    }

    return (
        <>
            {
                <YesNoForm {...YesNoFormProps} />
            }
        </>
    );
}

export default ConfirmSaasInstance
export { ConfirmSaasInstance };
