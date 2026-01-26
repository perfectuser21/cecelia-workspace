/**
 * Shared loading and error state components
 */
import { Loader, AlertCircle } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = '加载中...' }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <Loader className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
        <p className="text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  error: string | Error;
  retry?: () => void;
}

export function ErrorState({ error, retry }: ErrorStateProps) {
  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
        <p className="text-sm text-red-600 mb-4">{errorMessage}</p>
        {retry && (
          <button
            onClick={retry}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            重试
          </button>
        )}
      </div>
    </div>
  );
}
