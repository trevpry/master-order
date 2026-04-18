import React from 'react';

const ChatMessageBubble = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;

  // Simple markdown-like rendering for code blocks and inline code
  const renderContent = (text) => {
    if (!text) return null;

    // Split by code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).split('\n');
        const lang = lines[0]?.trim();
        const code = lang ? lines.slice(1).join('\n') : lines.join('\n');
        return (
          <pre key={i} className="bg-gray-900 text-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-sm">
            {lang && <div className="text-xs text-gray-400 mb-1">{lang}</div>}
            <code>{code}</code>
          </pre>
        );
      }
      // Handle inline code
      const inlineParts = part.split(/(`[^`]+`)/g);
      return (
        <span key={i}>
          {inlineParts.map((ip, j) => {
            if (ip.startsWith('`') && ip.endsWith('`')) {
              return (
                <code key={j} className="bg-gray-200 text-pink-600 px-1 py-0.5 rounded text-sm">
                  {ip.slice(1, -1)}
                </code>
              );
            }
            // Handle newlines
            return ip.split('\n').map((line, k, arr) => (
              <React.Fragment key={`${j}-${k}`}>
                {line}
                {k < arr.length - 1 && <br />}
              </React.Fragment>
            ));
          })}
        </span>
      );
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-blue-600 text-white'
            : isError
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">
          {renderContent(message.content)}
          {message.isStreaming && !message.content && (
            <span className="inline-flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </span>
          )}
          {message.isStreaming && message.content && (
            <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-text-bottom"></span>
          )}
        </div>
        {message.model && !isUser && (
          <div className="text-xs text-gray-400 mt-1">{message.model}</div>
        )}
      </div>
    </div>
  );
};

export default ChatMessageBubble;
