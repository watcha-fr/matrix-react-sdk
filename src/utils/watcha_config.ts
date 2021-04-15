import SdkConfig from "../SdkConfig";

export function getSupportEmailAddress(): string {
    return SdkConfig.get().watcha_supportEmailAddress || "contact@watcha.fr";
}
