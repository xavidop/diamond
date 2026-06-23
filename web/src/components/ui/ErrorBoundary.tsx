import { Component, type ReactNode } from "react";
import { ErrorBox } from "./Primitives";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-2xl mx-auto py-12">
          <ErrorBox error={this.state.error} />
          <div className="mt-4 text-center">
            <button
              onClick={() => this.setState({ error: null })}
              className="btn btn-primary"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
