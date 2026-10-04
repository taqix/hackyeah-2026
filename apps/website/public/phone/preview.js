const shell = document.getElementById("phone-shell");
const slot = document.getElementById("phone-slot");
const notice = document.getElementById("preview-notice");
const dismissedKey = "movo-phone-preview-notice-dismissed";

function fitPhone() {
  if (window.innerWidth <= 600) return;
  const scale = Math.min(1, (window.innerWidth - 32) / 430, (window.innerHeight - 32) / 902);
  shell.style.transform = `scale(${scale})`;
  slot.style.width = `${430 * scale}px`;
  slot.style.height = `${902 * scale}px`;
}

window.addEventListener("resize", fitPhone);
fitPhone();

try {
  if (!sessionStorage.getItem(dismissedKey)) notice.showModal();
} catch {
  notice.showModal();
}

notice.addEventListener("close", () => {
  try {
    sessionStorage.setItem(dismissedKey, "1");
  } catch {
    // Browser storage is optional; the dialog still closes.
  }
});
document.getElementById("dismiss-notice").addEventListener("click", () => notice.close());
