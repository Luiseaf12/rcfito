import { type ReactNode } from "react"

export type RecordDetailItem = {
  key: string
  label: string
  value: ReactNode
}

export type RecordDetailsProps = {
  items: readonly RecordDetailItem[]
}

/** Values arrive formatted by the domain, including dates, money and badges. */
export function RecordDetails({ items }: RecordDetailsProps) {
  return (
    <dl className="catalog-details tw:flex tw:flex-col tw:gap-4">
      {items.map(({ key, label, value }) => (
        <div key={key} className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
          <dt>{label}</dt>
          <dd className="tw:break-words">{value ?? "Sin información"}</dd>
        </div>
      ))}
    </dl>
  )
}
