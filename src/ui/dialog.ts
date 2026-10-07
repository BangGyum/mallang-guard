export function mountDialog(root: HTMLElement, dialog: HTMLDialogElement, onCancel: () => void) {
  dialog.setAttribute('aria-labelledby', 'dialog-title');
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    onCancel();
  });
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  root.append(dialog);
  dialog.showModal();
  return {
    dispose() {
      dialog.close();
      dialog.remove();
    },
  };
}
