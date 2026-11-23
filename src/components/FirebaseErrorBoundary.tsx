import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  friendlyMessage: string;
}

export class FirebaseErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    friendlyMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    let friendlyMessage = '頁面渲染時發生非預期錯誤，請重新載入道場。';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed === 'object' && 'operationType' in parsed) {
        friendlyMessage =
          '雲端數據同步權限不足或連線異常，請確認已登入有效帳號後再試。';
      }
    } catch {
      // Standard React error
    }
    return { hasError: true, friendlyMessage };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, friendlyMessage: '' });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen flex items-center justify-center p-6 bg-[#10151F] text-[#F2EEE6]">
          <div className="max-w-md w-full rounded-2xl border border-[#F2EEE6]/14 bg-[#161D2A] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-[#E25A48]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-base font-bold text-[#F6F2EA]">道場暫時中斷</h2>
            </div>
            <p className="text-sm leading-relaxed text-[#C2C9D6]">
              {this.state.friendlyMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C93E2D] hover:bg-[#D94A38] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重新載入</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
