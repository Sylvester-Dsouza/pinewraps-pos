import { POSPaymentMethod, POSPaymentStatus } from '@/types/order';

export interface PaymentMetadata {
    cashAmount?: number;
    changeAmount?: number;
    isSplitPayment?: boolean;
    splitFirstMethod?: POSPaymentMethod;
    splitFirstAmount?: number;
    splitFirstReference?: string;
    splitSecondMethod?: POSPaymentMethod;
    splitSecondAmount?: number;
    splitSecondReference?: string;
    futurePaymentMethod?: POSPaymentMethod;
}

export interface PaymentRequest {
    orderId: string;
    amount: number;
    method: POSPaymentMethod;
    reference?: string;
    status?: POSPaymentStatus;
    metadata?: PaymentMetadata;
}

export interface PaymentResponse {
    success: boolean;
    payment?: any;
    order?: any;
    error?: string;
}

class PaymentService {
    private apiUrl: string;

    constructor() {
        this.apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    }

    /**
     * Process a payment for an order
     */
    async processPayment(data: PaymentRequest): Promise<PaymentResponse> {
        try {
            const response = await fetch(`${this.apiUrl}/api/pos/orders/${data.orderId}/payments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to process payment');
            }

            return result;
        } catch (error) {
            console.error('Payment processing error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Calculate split payment amounts
     */
    calculateSplitAmounts(total: number, firstAmount: number): { firstAmount: number; secondAmount: number } {
        const roundedFirstAmount = Math.round(firstAmount * 100) / 100;
        const roundedSecondAmount = Math.round((total - roundedFirstAmount) * 100) / 100;
        
        return {
            firstAmount: roundedFirstAmount,
            secondAmount: roundedSecondAmount
        };
    }

    /**
     * Validate payment amount
     */
    validatePaymentAmount(amount: number, total: number, isPartial: boolean = false): boolean {
        if (amount <= 0) return false;
        if (isPartial) return amount < total;
        return Math.abs(amount - total) < 0.01;
    }

    /**
     * Prepare payment metadata based on payment method
     */
    preparePaymentMetadata(
        method: POSPaymentMethod,
        amount: number,
        options: {
            cashAmount?: number;
            changeAmount?: number;
            splitFirstMethod?: POSPaymentMethod;
            splitFirstAmount?: number;
            splitFirstReference?: string;
            splitSecondMethod?: POSPaymentMethod;
            splitSecondAmount?: number;
            splitSecondReference?: string;
            futurePaymentMethod?: POSPaymentMethod;
        } = {}
    ): PaymentMetadata {
        const metadata: PaymentMetadata = {};

        switch (method) {
            case POSPaymentMethod.CASH:
                metadata.cashAmount = options.cashAmount || amount;
                metadata.changeAmount = options.changeAmount || 0;
                break;

            case POSPaymentMethod.SPLIT:
                metadata.isSplitPayment = true;
                metadata.splitFirstMethod = options.splitFirstMethod;
                metadata.splitFirstAmount = options.splitFirstAmount;
                metadata.splitFirstReference = options.splitFirstReference;
                metadata.splitSecondMethod = options.splitSecondMethod;
                metadata.splitSecondAmount = options.splitSecondAmount;
                metadata.splitSecondReference = options.splitSecondReference;
                break;

            case POSPaymentMethod.PARTIAL:
                metadata.futurePaymentMethod = options.futurePaymentMethod;
                break;
        }

        return metadata;
    }

    /**
     * Get payment status based on amount and total
     */
    getPaymentStatus(amount: number, total: number): POSPaymentStatus {
        if (Math.abs(amount - total) < 0.01) {
            return POSPaymentStatus.FULLY_PAID;
        }
        if (amount < total) {
            return POSPaymentStatus.PARTIALLY_PAID;
        }
        return POSPaymentStatus.PENDING;
    }
}

export const paymentService = new PaymentService();
export default paymentService;
