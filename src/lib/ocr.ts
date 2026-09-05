import type Tesseract from "tesseract.js";

let worker: Tesseract.Worker | null = null;
let starting: Promise<Tesseract.Worker> | null = null;

async function getWorker() {
  if (worker) return worker;
  if (starting) return starting;
  starting = (async () => {
    const T = await import("tesseract.js");
    const w = await T.createWorker("eng", 1, {
      logger: () => undefined,
    });
    worker = w;
    return w;
  })();
  return starting;
}

export async function ocrSource(source: HTMLCanvasElement | File | Blob | string) {
  const w = await getWorker();
  const { data } = await w.recognize(source);
  return data.text ?? "";
}

export function canvasHash(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let h = 0;
  for (let i = 0; i < data.length; i += 64) {
    h = (Math.imul(h, 31) + data[i]) | 0;
  }
  return h;
}

export function grabFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const w = Math.min(1600, video.videoWidth || 1600);
  const h = Math.round(((video.videoHeight || 900) / (video.videoWidth || 1600)) * w);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(video, 0, 0, w, h);
}

export function sliceCanvas(source: HTMLCanvasElement, x0: number, x1: number) {
  const sx = Math.floor(source.width * x0);
  const sw = Math.max(40, Math.floor(source.width * (x1 - x0)));
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.drawImage(source, sx, 0, sw, source.height, 0, 0, sw, source.height);
  return out;
}
