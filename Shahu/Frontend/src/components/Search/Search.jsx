export function Search({ value, onChange, placeholder = 'Search' }) {
  return (
    <input
      className="search"
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}
