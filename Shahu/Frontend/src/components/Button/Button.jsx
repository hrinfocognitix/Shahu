export function Button({ children, variant = 'primary', ...props }) {
  return (
    <button className={`btn btn-${variant}`} type="button" {...props}>
      {children}
    </button>
  );
}
