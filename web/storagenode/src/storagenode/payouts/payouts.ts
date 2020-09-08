// Copyright (C) 2020 Storj Labs, Inc.
// See LICENSE for copying information.

import { getMonthsBeforeNow } from '@/app/utils/payout';

/**
 * Exposes all payout-related functionality.
 */
export interface PayoutApi {
    /**
     * Fetches paystubs by selected period.
     * @throws Error
     */
    getPaystubsForPeriod(paymentInfoParameters: PaymentInfoParameters): Promise<Paystub[]>;

    /**
     * Fetches available payout periods.
     * @throws Error
     */
    getPayoutPeriods(id: string): Promise<PayoutPeriod[]>;

    /**
     * Fetches held history for all satellites.
     * @throws Error
     */
    getHeldHistory(): Promise<SatelliteHeldHistory[]>;

    /**
     * Fetch estimated payout information.
     * @throws Error
     */
    getEstimatedPayout(satelliteId: string): Promise<EstimatedPayout>;

    /**
     * Fetches payout history for all satellites.
     * @throws Error
     */
    getPayoutHistory(period: string): Promise<SatellitePayoutForPeriod[]>;
}

// TODO: move to config.
/**
 * Divider to convert payout amounts to cents.
 */
const PRICE_DIVIDER: number = 10000;

/**
 * Represents payout period month and year.
 */
export class PayoutPeriod {
    public constructor(
        public year: number = new Date().getUTCFullYear(),
        public month: number = new Date().getUTCMonth(),
    ) {}

    public get period(): string {
        return this.month < 9 ? `${this.year}-0${this.month + 1}` : `${this.year}-${this.month + 1}`;
    }

    /**
     * Parses PayoutPeriod from string.
     * @param period string
     */
    public static fromString(period: string): PayoutPeriod {
        const periodArray = period.split('-');

        return new PayoutPeriod(parseInt(periodArray[0]), parseInt(periodArray[1]) - 1);
    }
}

/**
 * Holds request arguments for payout information.
 */
export class PaymentInfoParameters {
    public constructor(
        public start: PayoutPeriod | null = null,
        public end: PayoutPeriod = new PayoutPeriod(),
        public satelliteId: string = '',
    ) {}
}

/**
 * PayStub is an entity that holds usage and cash amounts that will be paid to storagenode operator after for month period.
 */
export class Paystub {
    public constructor(
        public usageAtRest: number = 0,
        public usageGet: number = 0,
        public usagePut: number = 0,
        public usageGetRepair: number = 0,
        public usagePutRepair: number = 0,
        public usageGetAudit: number = 0,
        public compAtRest: number = 0,
        public compGet: number = 0,
        public compPut: number = 0,
        public compGetRepair: number = 0,
        public compPutRepair: number = 0,
        public compGetAudit: number = 0,
        public surgePercent: number = 0,
        public held: number = 0,
        public owed: number = 0,
        public disposed: number = 0,
        public paid: number = 0,
    ) {}

    /**
     * Returns payout amount multiplier.
     */
    public get surgeMultiplier(): number {
        // 0 in backend uses instead of "without multiplier"
        return this.surgePercent === 0 ? 1 : this.surgePercent / 100;
    }
}

/**
 * Summary of paystubs by period.
 * Payout amounts converted to cents.
 */
export class TotalPaystubForPeriod {
    public usageAtRest: number = 0;
    public usageGet: number = 0;
    public usagePut: number = 0;
    public usageGetRepair: number = 0;
    public usagePutRepair: number = 0;
    public usageGetAudit: number = 0;
    public compAtRest: number = 0;
    public compGet: number = 0;
    public compPut: number = 0;
    public compGetRepair: number = 0;
    public compPutRepair: number = 0;
    public compGetAudit: number = 0;
    public surgePercent: number = 0;
    public held: number = 0;
    public owed: number = 0;
    public disposed: number = 0;
    public paid: number = 0;
    public paidWithoutSurge: number = 0;

    public constructor(
        paystubs: Paystub[] = [],
    ) {
        paystubs.forEach(paystub => {
            this.usageAtRest += paystub.usageAtRest;
            this.usageGet += paystub.usageGet;
            this.usagePut += paystub.usagePut;
            this.usageGetRepair += paystub.usageGetRepair;
            this.usagePutRepair += paystub.usagePutRepair;
            this.usageGetAudit += paystub.usageGetAudit;
            this.compAtRest += this.convertToCents(paystub.compAtRest);
            this.compGet += this.convertToCents(paystub.compGet);
            this.compPut += this.convertToCents(paystub.compPut);
            this.compGetRepair += this.convertToCents(paystub.compGetRepair);
            this.compPutRepair += this.convertToCents(paystub.compPutRepair);
            this.compGetAudit += this.convertToCents(paystub.compGetAudit);
            this.held += this.convertToCents(paystub.held);
            this.owed += this.convertToCents(paystub.owed);
            this.disposed += this.convertToCents(paystub.disposed);
            this.paid += this.convertToCents(paystub.paid);
            this.surgePercent = this.convertToCents(paystub.surgePercent);
            this.paidWithoutSurge += this.convertToCents(paystub.paid) / paystub.surgeMultiplier;
        });
    }

    private convertToCents(value: number): number {
        return value / PRICE_DIVIDER;
    }
}

/**
 * Holds accumulated held and earned payouts.
 */
export class TotalHeldAndPaid {
    public held: number = 0;
    public paid: number = 0;
    // TODO: remove
    public currentMonthEarnings: number = 0;

    public constructor(
        paystubs: Paystub[] = [],
    ) {
        paystubs.forEach(paystub => {
            this.held += this.convertToCents(paystub.held - paystub.disposed);
            this.paid += this.convertToCents(paystub.paid);
        });
    }

    public setCurrentMonthEarnings(value: number): void {
        this.currentMonthEarnings = value;
    }

    private convertToCents(value: number): number {
        return value / PRICE_DIVIDER;
    }
}

/**
 * Holds held history information for all satellites.
 */
export class SatelliteHeldHistory {
    public constructor(
        public satelliteID: string = '',
        public satelliteName: string = '',
        public firstPeriod: number = 0,
        public secondPeriod: number = 0,
        public thirdPeriod: number = 0,
        public totalHeld: number = 0,
        public totalDisposed: number = 0,
        public joinedAt: Date = new Date(),
    ) {
        this.totalHeld = this.totalHeld / PRICE_DIVIDER;
        this.totalDisposed = this.totalDisposed / PRICE_DIVIDER;
        this.firstPeriod = this.firstPeriod / PRICE_DIVIDER;
        this.secondPeriod = this.secondPeriod / PRICE_DIVIDER;
        this.thirdPeriod = this.thirdPeriod / PRICE_DIVIDER;
    }

    public get monthsWithNode(): number {
        return getMonthsBeforeNow(this.joinedAt);
    }
}

/**
 * Contains estimated payout information for current and last periods.
 */
export class EstimatedPayout {
    public constructor(
        public currentMonth: PreviousMonthEstimatedPayout = new PreviousMonthEstimatedPayout(),
        public previousMonth: PreviousMonthEstimatedPayout = new PreviousMonthEstimatedPayout(),
    ) {}
}

/**
 * Contains last month estimated payout information.
 */
export class PreviousMonthEstimatedPayout {
    public constructor(
        public egressBandwidth: number = 0,
        public egressBandwidthPayout: number = 0,
        public egressRepairAudit: number = 0,
        public egressRepairAuditPayout: number = 0,
        public diskSpace: number = 0,
        public diskSpacePayout: number = 0,
        public heldRate: number = 0,
        public payout: number = 0,
        public held: number = 0,
    ) {}
}


/**
 * Contains payout information for payout history table.
 */
export class SatellitePayoutForPeriod {
    public constructor(
        public satelliteID: string = '',
        public satelliteName: string = '',
        public age: number = 1,
        public earned: number = 0,
        public surge: number = 0,
        public surgePercent: number = 0,
        public held: number = 0,
        public afterHeld: number = 0,
        public disposed: number = 0,
        public paid: number = 0,
        public receipt: string = '',
        public isExitComplete: boolean = false,
        public heldPercent: number = 0,
    ) {
        this.earned = this.earned / PRICE_DIVIDER;
        this.surge = this.surge / PRICE_DIVIDER;
        this.held = this.held / PRICE_DIVIDER;
        this.afterHeld = this.afterHeld / PRICE_DIVIDER;
        this.disposed = this.disposed / PRICE_DIVIDER;
        this.paid = this.paid / PRICE_DIVIDER;
    }
}
