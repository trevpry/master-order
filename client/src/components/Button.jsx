/**
 * components/Button.jsx
 * Button component for Master Order
 */
import '../styles/Button.css';

function Button({ children, onClick, className = '', ...props }) {
  return (
    <button
      className={`button ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
