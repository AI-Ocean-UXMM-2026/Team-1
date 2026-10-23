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
  return new Promise((resolve) => {
    // Simulate API delay
    setTimeout(() => {
      // Build QR text (simplified MMQR format)
      const qrText = [
        "MMQR",
        "v1",
        request.merchantId,
        String(request.amount),
        request.reference,
        request.merchantName || "Oern",
      ].join("|");

      // Generate QR code using canvas (mock implementation)
      // In production, use qrcode.react or similar
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 300, 300);

        // Draw a simple pattern as mock QR (real implementation would use QR library)
        ctx.fillStyle = "#000000";
        const cellSize = 15;
        const pattern = generateMockQRPattern(qrText);

        for (let i = 0; i < 20; i++) {
          for (let j = 0; j < 20; j++) {
            if (pattern[(i * 20 + j) % pattern.length] === "1") {
              ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
            }
          }
        }
      }

      const dataUrl = canvas.toDataURL("image/png");

      resolve({
        dataUrl,
        qrText,
        request,
      });
    }, 300);
  });
}

/**
 * Generate a mock QR pattern for display purposes.
 * In production, use qrcode library to generate real QR codes.
 */
function generateMockQRPattern(text: string): string {
  // Hash the text to generate a consistent pattern
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  // Use hash to seed pattern generation
  const pattern: string[] = [];
  for (let i = 0; i < 400; i++) {
    hash = (hash * 9301 + 49297) % 233280;
    pattern.push(hash % 2 === 0 ? "1" : "0");
  }

  return pattern.join("");
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
