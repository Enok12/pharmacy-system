"use client";

import Modal from "./Modal";
import Button from "../ui/Button";

/**
 * Every destructive or hard-to-undo action (deactivate a user, delete a
 * batch, cancel a sale) should confirm through this component rather than
 * acting immediately — this is what "no silent inventory modifications"
 * (Phase 8 rule) looks like at the UI layer.
 *
 * @example
 * <ConfirmDialog
 *   isOpen={confirmOpen}
 *   title="Deactivate this product?"
 *   description="It will no longer appear in POS search or new sales."
 *   confirmLabel="Deactivate"
 *   variant="danger"
 *   onConfirm={handleDeactivate}
 *   onCancel={() => setConfirmOpen(false)}
 * />
 */
export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Please wait..." : confirmLabel}
          </Button>
        </>
      }
    >
      {description && (
        <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
      )}
    </Modal>
  );
}
