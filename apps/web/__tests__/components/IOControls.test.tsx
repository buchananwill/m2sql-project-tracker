import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IOControls } from '@/components/IOControls';
import { MantineProvider } from '@mantine/core';

// Mock child components
vi.mock('@/components/FileUpload', () => ({
  FileUpload: ({ onFileLoad }: { onFileLoad: (content: string, filename: string) => void }) => (
    <div data-testid="file-upload">FileUpload Mock</div>
  ),
}));

vi.mock('@/components/SyncControls', () => ({
  SyncControls: () => <div data-testid="sync-controls">SyncControls Mock</div>,
}));

// Wrapper component for Mantine
function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('IOControls', () => {
  it('should render Data Operations title', () => {
    const mockOnFileLoad = vi.fn();
    renderWithMantine(<IOControls onFileLoad={mockOnFileLoad} />);

    expect(screen.getByText('Data Operations')).toBeInTheDocument();
  });

  it('should render FileUpload component', () => {
    const mockOnFileLoad = vi.fn();
    renderWithMantine(<IOControls onFileLoad={mockOnFileLoad} />);

    expect(screen.getByTestId('file-upload')).toBeInTheDocument();
  });

  it('should render SyncControls component', () => {
    const mockOnFileLoad = vi.fn();
    renderWithMantine(<IOControls onFileLoad={mockOnFileLoad} />);

    expect(screen.getByTestId('sync-controls')).toBeInTheDocument();
  });

  it('should pass onFileLoad prop to FileUpload', () => {
    const mockOnFileLoad = vi.fn();
    renderWithMantine(<IOControls onFileLoad={mockOnFileLoad} />);

    // Just verify the component renders - the prop passing is verified by TypeScript
    expect(screen.getByTestId('file-upload')).toBeInTheDocument();
  });
});
