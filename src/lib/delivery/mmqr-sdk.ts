import QRCode from "qrcode";

/**
 * Mock MMQR SDK for generating QR codes for payments.
 * In production, this would integrate with the actual MMQR service.
 */

export interface MMQRPaymentRequest {
  /** Merchant/receiver identifier */
  merchantId: string;
  /** Amount in MMK */
  amount: number;
  /** Payment reference code (e.g., tracking code) */
  reference: string;
  /** Optional merchant name */
  merchantName?: string;
}

export interface MMQRQRCode {
  /** Data URL of the QR code image */
  dataUrl: string;
  /** Raw QR text (for manual entry if needed) */
  qrText: string;
  /** The original request used to generate this */
  request: MMQRPaymentRequest;
}

/**
 * Generate a mock MMQR QR code. In production, this would call the actual MMQR API.
 * The QR encodes: MMQR|v1|merchantId|amount|reference|merchantName
 */
export function generateMMQRQRCode(
  request: MMQRPaymentRequest,
): Promise<MMQRQRCode> {
  return new Promise((resolve, reject) => {
    const qrText = [
      "MMQR",
      "v1",
      request.merchantId,
      String(request.amount),
      request.reference,
      request.merchantName || "Oern",
    ].join("|");

    QRCode.toDataURL(
      qrText,
      {
        width: 300,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      },
      (err, dataUrl) => {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          dataUrl,
          qrText,
          request,
        });
      },
    );
  });
}

/**
 * Download a QR code image to the user's device.
 */
export function downloadQRCode(qrCode: MMQRQRCode, filename?: string): void {
  const link = document.createElement("a");
  link.href = qrCode.dataUrl;
  link.download = filename || `mmqr-${qrCode.request.reference}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Simulate payment confirmation after scanning QR code.
 * In production, this would poll the MMQR provider for payment status.
 */
export async function confirmMMQRPayment(
  reference: string,
  timeoutMs: number = 120000, // 2 minutes default
): Promise<boolean> {
  // Simulate checking payment status
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;

      // Mock: payment is confirmed after random delay between 1-30 seconds
      if (elapsed > timeoutMs || Math.random() < 0.1) {
        clearInterval(checkInterval);
        resolve(elapsed <= timeoutMs);
      }
    }, 500);
  });
}
