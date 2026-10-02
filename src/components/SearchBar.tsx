interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="search" role="search">
      <label htmlFor="article-search" className="visually-hidden">
        Search articles
      </label>
      <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.75" fill="none" stroke="currentColor" strokeWidth="1.75" />
        <path d="M13 13l4.25 4.25" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      <input
        id="article-search"
        className="search-input"
        type="search"
        placeholder="Search articles"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onChange('');
        }}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}