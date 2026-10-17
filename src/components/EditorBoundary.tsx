import { Component, type ReactNode } from 'react';

export default class EditorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="loading-panel" role="alert">
      <p>The rich text editor could not load. Export your document using the document tools before reloading.</p>
      <button onClick={() => window.location.reload()}>Reload editor</button>
    </div>;
    return this.props.children;
  }
}
