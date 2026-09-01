import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// Mock the api utility so no real axios calls happen
vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Helper component to expose auth context values in tests
const AuthConsumer = () => {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="plan">{auth.currentPlan}</span>
      <span data-testid="currency">{auth.currencySymbol}</span>
      <span data-testid="is-admin">{String(auth.isAdmin)}</span>
      <button onClick={() => auth.login('tok123', {
        user_id: 1, name: 'Test Admin', email: 't@t.com', role_name: 'Admin',
      }, null, ['sales', 'inventory'])}>
        login
      </button>
      <button onClick={auth.logout}>logout</button>
    </div>
  );
};

// ─── AuthProvider initial state ───────────────────────────────

describe('AuthProvider - initial state (no stored token)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts unauthenticated when no token in storage', async () => {
    render(<AuthProvider><AuthConsumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('authenticated').textContent).toBe('false');
    });
  });

  it('defaults currentPlan to free when modules empty', async () => {
    render(<AuthProvider><AuthConsumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('plan').textContent).toBe('free');
    });
  });

  it('defaults currency symbol to Rs.', async () => {
    render(<AuthProvider><AuthConsumer /></AuthProvider>);
    await waitFor(() => {
      expect(screen.getByTestId('currency').textContent).toBe('Rs.');
    });
  });
});

// ─── login / logout ──────────────────────────────────────────

describe('login and logout', () => {
  beforeEach(() => {
    localStorage.clear();
    // suppress fetch calls that happen on login (for verify endpoint)
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
  });

  it('sets authenticated after login', async () => {
    render(<AuthProvider><AuthConsumer /></AuthProvider>);
    await waitFor(() => screen.getByTestId('authenticated'));

    await act(async () => {
      await userEvent.click(screen.getByText('login'));
    });

    expect(screen.getByTestId('authenticated').textContent).toBe('true');
  });

  it('stores token in localStorage after login', async () => {
    render(<AuthProvider><AuthConsumer /></AuthProvider>);
    await waitFor(() => screen.getByTestId('authenticated'));

    await act(async () => {
      await userEvent.click(screen.getByText('login'));
    });

    expect(localStorage.getItem('token')).toBe('tok123');
  });

  it('becomes unauthenticated after logout', async () => {
    render(<AuthProvider><AuthConsumer /></AuthProvider>);
    await waitFor(() => screen.getByTestId('authenticated'));

    await act(async () => {
      await userEvent.click(screen.getByText('login'));
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    await act(async () => {
      await userEvent.click(screen.getByText('logout'));
    });
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('removes token from localStorage on logout', async () => {
    render(<AuthProvider><AuthConsumer /></AuthProvider>);
    await waitFor(() => screen.getByTestId('authenticated'));

    await act(async () => {
      await userEvent.click(screen.getByText('login'));
    });
    await act(async () => {
      await userEvent.click(screen.getByText('logout'));
    });
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('sets isAdmin to true when role is Admin', async () => {
    render(<AuthProvider><AuthConsumer /></AuthProvider>);
    await waitFor(() => screen.getByTestId('authenticated'));

    await act(async () => {
      await userEvent.click(screen.getByText('login'));
    });

    expect(screen.getByTestId('is-admin').textContent).toBe('true');
  });

  it('sets currentPlan to active when modules provided', async () => {
    render(<AuthProvider><AuthConsumer /></AuthProvider>);
    await waitFor(() => screen.getByTestId('authenticated'));

    await act(async () => {
      await userEvent.click(screen.getByText('login'));
    });

    expect(screen.getByTestId('plan').textContent).toBe('active');
  });
});

// ─── hasPermission ───────────────────────────────────────────

const PermissionConsumer = ({ moduleKey }: { moduleKey: string }) => {
  const { hasPermission, login } = useAuth();
  return (
    <div>
      <button onClick={() => login('t', { user_id: 1, name: 'X', email: 'x@x.com', role_name: 'Cashier' }, ['sales.pos', 'inventory.products'])}>
        login cashier
      </button>
      <span data-testid="has-perm">{String(hasPermission(moduleKey))}</span>
    </div>
  );
};

describe('hasPermission', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
  });

  it('returns true for Admin (null permissions)', async () => {
    const AdminConsumer = () => {
      const { hasPermission, login } = useAuth();
      return (
        <div>
          <button onClick={() => login('t', { user_id: 1, name: 'A', email: 'a@a.com', role_name: 'Admin' }, null)}>
            login admin
          </button>
          <span data-testid="has-perm">{String(hasPermission('inventory.products'))}</span>
        </div>
      );
    };
    render(<AuthProvider><AdminConsumer /></AuthProvider>);
    await waitFor(() => screen.getByText('login admin'));

    await act(async () => {
      await userEvent.click(screen.getByText('login admin'));
    });

    expect(screen.getByTestId('has-perm').textContent).toBe('true');
  });

  it('returns true when user has exact module key', async () => {
    render(<AuthProvider><PermissionConsumer moduleKey="sales.pos" /></AuthProvider>);
    await waitFor(() => screen.getByText('login cashier'));

    await act(async () => {
      await userEvent.click(screen.getByText('login cashier'));
    });

    expect(screen.getByTestId('has-perm').textContent).toBe('true');
  });

  it('returns true when user has sub-key that matches parent', async () => {
    render(<AuthProvider><PermissionConsumer moduleKey="sales" /></AuthProvider>);
    await waitFor(() => screen.getByText('login cashier'));

    await act(async () => {
      await userEvent.click(screen.getByText('login cashier'));
    });

    // 'sales' matches because user has 'sales.pos'
    expect(screen.getByTestId('has-perm').textContent).toBe('true');
  });

  it('returns false when user lacks the module key', async () => {
    render(<AuthProvider><PermissionConsumer moduleKey="accounts" /></AuthProvider>);
    await waitFor(() => screen.getByText('login cashier'));

    await act(async () => {
      await userEvent.click(screen.getByText('login cashier'));
    });

    expect(screen.getByTestId('has-perm').textContent).toBe('false');
  });
});

// ─── hasModule ────────────────────────────────────────────────

const ModuleConsumer = ({ moduleName }: { moduleName: string }) => {
  const { hasModule, login } = useAuth();
  return (
    <div>
      <button onClick={() => login('t', { user_id: 1, name: 'X', email: 'x@x.com', role_name: 'Admin' }, null, ['sales', 'inventory'])}>
        login
      </button>
      <span data-testid="has-module">{String(hasModule(moduleName))}</span>
    </div>
  );
};

describe('hasModule', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
  });

  it('returns true for subscribed module', async () => {
    render(<AuthProvider><ModuleConsumer moduleName="sales" /></AuthProvider>);
    await waitFor(() => screen.getByText('login'));
    await act(async () => { await userEvent.click(screen.getByText('login')); });
    expect(screen.getByTestId('has-module').textContent).toBe('true');
  });

  it('returns false for unsubscribed module', async () => {
    render(<AuthProvider><ModuleConsumer moduleName="hr" /></AuthProvider>);
    await waitFor(() => screen.getByText('login'));
    await act(async () => { await userEvent.click(screen.getByText('login')); });
    expect(screen.getByTestId('has-module').textContent).toBe('false');
  });

  it('returns true for all modules when modules list is empty (fallback)', async () => {
    const FallbackConsumer = () => {
      const { hasModule, login } = useAuth();
      return (
        <div>
          <button onClick={() => login('t', { user_id: 1, name: 'X', email: 'x@x.com', role_name: 'Admin' }, null, [])}>
            login
          </button>
          <span data-testid="has-module">{String(hasModule('hr'))}</span>
        </div>
      );
    };
    render(<AuthProvider><FallbackConsumer /></AuthProvider>);
    await waitFor(() => screen.getByText('login'));
    await act(async () => { await userEvent.click(screen.getByText('login')); });
    expect(screen.getByTestId('has-module').textContent).toBe('true');
  });
});
