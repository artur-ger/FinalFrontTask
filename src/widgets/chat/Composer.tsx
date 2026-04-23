import { useState } from 'react'
import type { ChatSettings } from '../../shared/types/chat'

interface ComposerProps {
  isGenerating: boolean
  settings: ChatSettings
  onSettingsChange: (next: Partial<ChatSettings>) => void
  onSend: (text: string, images: string[]) => Promise<void>
  onStop: () => void
}

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })

export const Composer = ({ isGenerating, settings, onSettingsChange, onSend, onStop }: ComposerProps) => {
  const [text, setText] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)

  const MAX_IMAGE_COUNT = 4
  const MAX_IMAGE_SIZE_MB = 4
  const canSend = text.trim().length > 0 || images.length > 0

  const handleSend = async () => {
    if (!canSend || isGenerating) {
      return
    }
    const snapshot = images
    setText('')
    setImages([])
    await onSend(text, snapshot)
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files) {
      return
    }

    const picked = Array.from(files)
    const accepted: File[] = []

    for (const file of picked) {
      if (accepted.length + images.length >= MAX_IMAGE_COUNT) {
        setValidationError(`You can attach up to ${MAX_IMAGE_COUNT} images.`)
        break
      }

      const tooLarge = file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024
      if (tooLarge) {
        setValidationError(`Image \"${file.name}\" is larger than ${MAX_IMAGE_SIZE_MB}MB.`)
        continue
      }

      accepted.push(file)
    }

    if (accepted.length === 0) {
      return
    }

    setValidationError(null)
    const base64Images = await Promise.all(accepted.map(async (file) => toBase64(file)))
    setImages((prev) => [...prev, ...base64Images])
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <section className="composer">
      {images.length > 0 && (
        <div className="image-grid">
          {images.map((image, index) => (
            <figure key={`${image.slice(0, 48)}-${index}`} className="preview-tile">
              <img src={image} alt="Attached preview" />
              <button type="button" className="btn btn-danger preview-remove" onClick={() => removeImage(index)}>
                Remove
              </button>
            </figure>
          ))}
        </div>
      )}

      {validationError && <div className="error-banner">{validationError}</div>}

      <textarea
        placeholder="Ask something..."
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            void handleSend()
          }
        }}
      />

      <div className="composer-actions">
        <label className="btn">
          + Image
          <input
            type="file"
            hidden
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(event) => void handleFiles(event.target.files)}
          />
        </label>

        <button type="button" className="btn btn-primary" onClick={() => void handleSend()} disabled={isGenerating || !canSend}>
          Send
        </button>

        {isGenerating && (
          <button type="button" className="btn btn-danger" onClick={onStop}>
            Stop generation
          </button>
        )}
      </div>

      <details className="settings">
        <summary>Generation settings</summary>
        <div className="settings-grid">
          <label>
            Temperature
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(event) => onSettingsChange({ temperature: Number(event.target.value) })}
            />
          </label>
          <label>
            Top P
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={settings.top_p}
              onChange={(event) => onSettingsChange({ top_p: Number(event.target.value) })}
            />
          </label>
          <label>
            Max tokens
            <input
              type="number"
              min="1"
              max="4096"
              step="1"
              value={settings.max_tokens}
              onChange={(event) => onSettingsChange({ max_tokens: Number(event.target.value) })}
            />
          </label>
          <label>
            Repetition penalty
            <input
              type="number"
              min="0"
              max="3"
              step="0.1"
              value={settings.repetition_penalty}
              onChange={(event) => onSettingsChange({ repetition_penalty: Number(event.target.value) })}
            />
          </label>
          <label>
            Model
            <input
              type="text"
              value={settings.model}
              onChange={(event) => onSettingsChange({ model: event.target.value })}
            />
          </label>
          <label className="system-prompt-field">
            System prompt
            <textarea
              value={settings.system_prompt}
              onChange={(event) => onSettingsChange({ system_prompt: event.target.value })}
              rows={4}
            />
          </label>
        </div>
      </details>
    </section>
  )
}
