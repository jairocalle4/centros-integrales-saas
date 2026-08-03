import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('Smoke Test', () => {
  it('should render successfully', () => {
    render(<div>NexoKids Test</div>);
    expect(screen.getByText('NexoKids Test')).toBeInTheDocument();
  });
});
