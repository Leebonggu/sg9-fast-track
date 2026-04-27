'use client'

import { TEMPLATES } from '../lib/templates'

type Props = {
  selectedId: string
  onChange: (id: string) => void
}

export default function TemplateSelector({ selectedId, onChange }: Props) {
  return (
    <div className="flex gap-2 mb-4">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedId === t.id
              ? 'bg-blue-700 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {t.name}
        </button>
      ))}
    </div>
  )
}
