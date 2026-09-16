// avatar.js: the user's picture wherever it shows, and the initials that
// stand in until one is chosen. The picture is kept as a small square data
// URL in the store, so it survives a reload with everything else.

export const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

// what goes inside an .app-avatar: the picture, or the initials
export const avatarInner = (user) => (user.avatar ? `<img class="app-avatar__img" src="${user.avatar}" alt="">` : initials(user.name));

export const avatarMarkup = (user, cls = "", attrs = "") => `<span class="app-avatar${cls ? ` ${cls}` : ""}"${attrs ? ` ${attrs}` : ""}>${avatarInner(user)}</span>`;

// a chosen file becomes a square of `size` px, cropped to its middle, as a
// JPEG data URL small enough to keep in the store
export function squareImage(file, size = 128) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The image could not be read"));
    };
    img.src = url;
  });
}
