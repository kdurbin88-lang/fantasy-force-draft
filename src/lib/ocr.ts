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
  const w = Math.min(960, video.videoWidth || 960);
  const h = Math.round(((video.videoHeight || 540) / (video.videoWidth || 960)) * w);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(video, 0, 0, w, h);
}
