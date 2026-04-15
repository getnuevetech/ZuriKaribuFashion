import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export default class CustomerServiceChatWidgetBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Keep chat failures isolated from the full page render tree.
    console.error('[chat-widget] render failure', error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
