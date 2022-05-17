import SdkConfig from "../SdkConfig";

export function getSupportEmailAddress(): string {
    return SdkConfig.get().watcha_support_email_address || "support@watcha.fr";
}
