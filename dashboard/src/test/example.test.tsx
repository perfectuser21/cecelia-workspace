import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Example test component
function ExampleComponent({ message }: { message: string }) {
  return <div data-testid="message">{message}</div>;
}

describe('Example Test Suite', () => {
  it('should render component with message', () => {
    render(<ExampleComponent message="Hello, Vitest!" />);
    const element = screen.getByTestId('message');
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('Hello, Vitest!');
  });

  it('should pass a simple assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle arrays', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });
});
