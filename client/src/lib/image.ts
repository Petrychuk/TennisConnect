export async function resizeImage(
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = e => {
      if (!e.target?.result) return reject("No file");
      img.src = e.target.result as string;
    };

    img.onload = () => {
      let { width, height } = img;

      const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
      width *= ratio;
      height *= ratio;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("No context");

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/webp", quality));
    };

    reader.readAsDataURL(file);
  });
}
