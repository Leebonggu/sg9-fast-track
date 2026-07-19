// 클라이언트에서 이미지 리사이즈/압축 (Vercel ~4.5MB 요청 한도 회피).
// 단, 주민번호 등 글자 식별 가능하도록 과도한 축소는 금지 (최대 변 1600px, JPEG 0.82).
export async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const MAX = 1600;
  let { width, height } = img;
  if (width > MAX || height > MAX) {
    const ratio = Math.min(MAX / width, MAX / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { base64: dataUrl.split(',')[1] ?? '', mimeType: file.type || 'image/jpeg' };
  ctx.drawImage(img, 0, 0, width, height);
  const out = canvas.toDataURL('image/jpeg', 0.82);
  return { base64: out.split(',')[1] ?? '', mimeType: 'image/jpeg' };
}
