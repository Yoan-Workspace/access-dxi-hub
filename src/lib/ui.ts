/** Laisse React/Radix démonter les portails avant la mise à jour suivante. */
export function afterUiSettled(run: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
}
