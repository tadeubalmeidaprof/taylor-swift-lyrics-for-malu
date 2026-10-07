type GiveUpDialogProps = {
  open: boolean
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function GiveUpDialog({
  open,
  loading,
  onCancel,
  onConfirm,
}: GiveUpDialogProps) {
  if (!open) return null

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="give-up-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="give-up-title"
        onClick={(event) => event.stopPropagation()}
      >
        <small>ENCERRAR RODADA</small>
        <h2 id="give-up-title">Revelar o resto da letra?</h2>
        <p>Você poderá ver toda a música e seguir para a próxima quando quiser.</p>

        <div className="dialog-actions">
          <button type="button" className="dialog-secondary" onClick={onCancel} disabled={loading}>
            Continuar
          </button>
          <button type="button" className="dialog-primary" onClick={onConfirm} disabled={loading}>
            {loading ? 'AGUARDE' : 'REVELAR LETRA'}
          </button>
        </div>
      </section>
    </div>
  )
}
