import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MermaidEditor } from '@/components/MermaidEditor';
import { MantineProvider } from '@mantine/core';
import { useAppStore } from '@/stores/useAppStore';

// Wrapper component for Mantine
function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('MermaidEditor', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      mermaidText: '',
      database: null,
      dataSource: null,
      errors: [],
    });
  });

  it('should render with initial value from store', () => {
    const initialValue = 'erDiagram\n  tasks {}';
    useAppStore.setState({ mermaidText: initialValue });

    renderWithMantine(<MermaidEditor />);

    const textarea = screen.getByRole('textbox', { name: /mermaid diagram/i });
    expect(textarea).toHaveValue(initialValue);
  });

  it('should call parseAndSetDatabase after debounce delay when typing', async () => {
    const user = userEvent.setup();
    renderWithMantine(<MermaidEditor />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'erDiagram');

    // Wait for debounce (500ms)
    await waitFor(
      () => {
        const state = useAppStore.getState();
        expect(state.mermaidText).toBe('erDiagram');
      },
      { timeout: 1000 }
    );
  });

  it('should sync with external value changes from store', async () => {
    renderWithMantine(<MermaidEditor />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('');

    // Simulate external value change (e.g., file upload)
    useAppStore.setState({ mermaidText: 'new value from file' });

    await waitFor(() => {
      expect(textarea).toHaveValue('new value from file');
    });

    // Wait a bit longer to ensure state doesn't change back
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(textarea).toHaveValue('new value from file');
  }, 10000);

  it('should display placeholder when empty', () => {
    renderWithMantine(<MermaidEditor />);

    const textarea = screen.getByPlaceholderText(/paste or type your mermaid/i);
    expect(textarea).toBeInTheDocument();
  });

  it('should have monospace font styling', () => {
    renderWithMantine(<MermaidEditor />);

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveStyle({ fontFamily: 'monospace' });
  });

  it('should update local value immediately while typing', async () => {
    const user = userEvent.setup();
    renderWithMantine(<MermaidEditor />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'test');

    // Local value should update immediately (no debounce for display)
    expect(textarea).toHaveValue('test');
  });
});
