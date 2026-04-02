interface Props {
  candidateName: string
  screeningTypeName: string
  currentIndex: number
  total: number
}

export function SessionHeader({
  candidateName,
  screeningTypeName,
  currentIndex,
  total,
}: Props) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{candidateName}</h1>
          <p className="text-sm text-gray-500">{screeningTypeName}</p>
        </div>
        <span className="text-sm text-gray-500 tabular-nums">
          Q {currentIndex + 1} / {total}
        </span>
      </div>
    </header>
  )
}
