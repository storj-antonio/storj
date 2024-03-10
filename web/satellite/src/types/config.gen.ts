// AUTOGENERATED BY configgen.go
// DO NOT EDIT.

import { MemorySize } from '@/types/common';

export class CaptchaConfig {
    login: MultiCaptchaConfig;
    registration: MultiCaptchaConfig;
}

export class FrontendConfig {
    externalAddress: string;
    satelliteName: string;
    satelliteNodeURL: string;
    stripePublicKey: string;
    partneredSatellites: PartneredSatellite[] | null;
    defaultProjectLimit: number;
    generalRequestURL: string;
    projectLimitsIncreaseRequestURL: string;
    gatewayCredentialsRequestURL: string;
    isBetaSatellite: boolean;
    betaSatelliteFeedbackURL: string;
    betaSatelliteSupportURL: string;
    documentationURL: string;
    couponCodeBillingUIEnabled: boolean;
    couponCodeSignupUIEnabled: boolean;
    fileBrowserFlowDisabled: boolean;
    linksharingURL: string;
    publicLinksharingURL: string;
    pathwayOverviewEnabled: boolean;
    captcha: CaptchaConfig;
    limitsAreaEnabled: boolean;
    defaultPaidStorageLimit: MemorySize;
    defaultPaidBandwidthLimit: MemorySize;
    inactivityTimerEnabled: boolean;
    inactivityTimerDuration: number;
    inactivityTimerViewerEnabled: boolean;
    optionalSignupSuccessURL: string;
    homepageURL: string;
    nativeTokenPaymentsEnabled: boolean;
    passwordMinimumLength: number;
    passwordMaximumLength: number;
    abTestingEnabled: boolean;
    pricingPackagesEnabled: boolean;
    galleryViewEnabled: boolean;
    neededTransactionConfirmations: number;
    objectBrowserPaginationEnabled: boolean;
    billingFeaturesEnabled: boolean;
    stripePaymentElementEnabled: boolean;
    unregisteredInviteEmailsEnabled: boolean;
    freeTierInvitesEnabled: boolean;
    userBalanceForUpgrade: number;
    limitIncreaseRequestEnabled: boolean;
    signupActivationCodeEnabled: boolean;
    allowedUsageReportDateRange: number;
    onboardingStepperEnabled: boolean;
    enableRegionTag: boolean;
    emissionImpactViewEnabled: boolean;
    applicationsPageEnabled: boolean;
    daysBeforeTrialEndNotification: number;
}

export class MultiCaptchaConfig {
    recaptcha: SingleCaptchaConfig;
    hcaptcha: SingleCaptchaConfig;
}

export class PartneredSatellite {
    name: string;
    address: string;
}

export class SingleCaptchaConfig {
    enabled: boolean;
    siteKey: string;
}