declare module "qrcode" {
  export type QRCodeToDataURLOptions = {
    color?: {
      dark?: string;
      light?: string;
    };
    errorCorrectionLevel?: string;
    margin?: number;
    width?: number;
  };

  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions,
  ): Promise<string>;

  const QRCode: {
    toDataURL: typeof toDataURL;
  };

  export default QRCode;
}
