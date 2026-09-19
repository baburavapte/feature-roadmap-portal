import { Link } from 'react-router-dom';

/**
 * AuthLayout — centered card layout shared by all auth pages.
 * Renders the app logo, a title, subtitle, and a form card.
 */
const AuthLayout = ({ title, subtitle, children }) => {
  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Logo */}
        <div className="auth-logo-wrap">
          <Link to="/" className="auth-brand">
            <div className="header-logo" style={{ width: 44, height: 44, fontSize: 22 }}>F</div>
            <span className="header-title" style={{ fontSize: 20 }}>Feature Roadmap</span>
          </Link>
        </div>

        {/* Card */}
        <div className="auth-card">
          {title && <h1 className="auth-title">{title}</h1>}
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
