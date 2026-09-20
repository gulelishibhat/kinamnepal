// Type shim for qrcode.react@4 — the package ships types but its `exports`
// map does not expose them under `moduleResolution: bundler`, so we declare
// the minimal surface we use here.
declare module 'qrcode.react' {
  import type { ComponentType } from 'react';

  interface QRCodeProps {
    value: string;
    size?: number;
    level?: 'L' | 'M' | 'Q' | 'H';
    bgColor?: string;
    fgColor?: string;
    marginSize?: number;
    title?: string;
    className?: string;
  }

  export const QRCodeSVG: ComponentType<QRCodeProps>;
  export const QRCodeCanvas: ComponentType<QRCodeProps>;
}
