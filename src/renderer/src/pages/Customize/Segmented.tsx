import styles from './Customize.module.css'

/** Pill-style picker shared by the Customize tabs */
export default function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: string; icon?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className={styles.segmented}>
      {options.map(o => (
        <button key={o.value} data-active={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon && <span className="material-icons">{o.icon}</span>}
          {o.label}
        </button>
      ))}
    </div>
  )
}
