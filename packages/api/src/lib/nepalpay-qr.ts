// ─────────────────────────────────────────────────────────────────────────────
//  NepalPay QR (EMVCo Merchant-Presented QR) generator.
//
//  Nepali wallets and banking apps (eSewa, Khalti, Fonepay, IME Pay, bank apps)
//  scan the EMVCo QR standard used by NCHL's NepalPay. This builds a spec-valid
//  QR string: a series of TLV (Tag-Length-Value) fields terminated by a CRC16
//  checksum. The values here are SAMPLE/DEVELOPER merchant details — replace the
//  merchant id/name from your bank's issued NepalPay/Fonepay merchant QR to go
//  live. The string is structurally valid so apps recognise it as a NepalPay QR.
// ─────────────────────────────────────────────────────────────────────────────

/** Build a single EMVCo TLV: 2-digit id + 2-digit length + value. */
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

/** CRC16-CCITT (0x1021, init 0xFFFF) over the payload incl. the "6304" tag. */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface NepalPayQrParams {
  merchantId: string;       // NepalPay/Fonepay merchant PAN (bank-issued)
  merchantName: string;     // shown in the payer's app
  merchantCity: string;
  amount?: number;          // omit for a "customer enters amount" QR
  billNumber?: string;      // e.g. order number, for reconciliation
  countryCode?: string;     // 'NP'
  currencyCode?: string;    // '524' = NPR (ISO 4217 numeric)
}

/**
 * Returns an EMVCo-format QR string for NepalPay.
 * Amount is dynamic ({AMOUNT} handled by caller if omitted here).
 */
export function buildNepalPayQr(p: NepalPayQrParams): string {
  const country = p.countryCode ?? 'NP';
  const currency = p.currencyCode ?? '524';

  // Merchant Account Information (tag 30 for NepalPay). Sub-fields:
  //   00 = globally unique identifier ("npi" scheme), 01 = merchant id.
  const merchantAccount = tlv('00', 'npi') + tlv('01', p.merchantId);

  const fields: string[] = [];
  fields.push(tlv('00', '01'));                       // payload format indicator
  fields.push(tlv('01', p.amount ? '12' : '11'));     // 11=static, 12=dynamic
  fields.push(tlv('30', merchantAccount));            // merchant account info (NepalPay)
  fields.push(tlv('52', '5732'));                     // MCC (5732 = electronics/misc retail sample)
  fields.push(tlv('53', currency));                   // transaction currency
  if (p.amount && p.amount > 0) {
    fields.push(tlv('54', p.amount.toFixed(2)));      // transaction amount
  }
  fields.push(tlv('58', country));                    // country code
  fields.push(tlv('59', p.merchantName.slice(0, 25)));// merchant name (max 25)
  fields.push(tlv('60', p.merchantCity.slice(0, 15)));// merchant city
  if (p.billNumber) {
    // Additional data field (tag 62), sub-field 01 = bill/reference number.
    fields.push(tlv('62', tlv('01', p.billNumber.slice(0, 25))));
  }

  const withoutCrc = fields.join('') + '6304'; // CRC tag id(63) + length(04)
  return withoutCrc + crc16(withoutCrc);
}
