import { type ComponentProps, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type RecordDialogProps = {
  open: boolean
  title: string
  description: string
  busy?: boolean
  onClose: () => void
  portalContainer?: ComponentProps<typeof DialogContent>["container"]
  finalFocus?: ComponentProps<typeof DialogContent>["finalFocus"]
  initialFocus?: ComponentProps<typeof DialogContent>["initialFocus"]
  contentId?: string
  children: ReactNode
}

/** Base UI adapter. Radix consumers adapt dismissal and return-focus APIs locally. */
export function RecordDialog({
  open,
  title,
  description,
  busy = false,
  onClose,
  portalContainer,
  finalFocus,
  initialFocus,
  contentId,
  children,
}: RecordDialogProps) {
  return (
    <Dialog
      open={open}
      disablePointerDismissal={busy}
      onOpenChange={(nextOpen, details) => {
        if (nextOpen) return
        if (busy) {
          details.cancel()
          return
        }
        onClose()
      }}
    >
      <DialogContent
        container={portalContainer}
        finalFocus={finalFocus}
        initialFocus={initialFocus}
        id={contentId}
        aria-modal="true"
        showCloseButton={!busy}
        aria-busy={busy}
        className="catalog-dialog tw:max-h-[calc(100dvh-2rem)] tw:max-w-[min(52rem,calc(100%-2rem))] tw:overflow-y-auto tw:sm:max-w-[min(52rem,calc(100%-2rem))]"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
