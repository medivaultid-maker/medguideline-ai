declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFData {
    numpages: number;
    text: string;
  }

  function pdf(dataBuffer: Buffer): Promise<PDFData>;

  export default pdf;
}
