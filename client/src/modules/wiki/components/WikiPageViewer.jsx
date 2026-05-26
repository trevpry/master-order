import React from 'react';
import { formatDate } from '../utils/dateFormat';

const WikiPageViewer = ({ page, onWikiLinkClick, onDelete }) => {
  if (!page) return null;

  // Render Markdown content with wiki-link support
  const renderContent = (content) => {
    if (!content) return null;

    // Split content into lines and render
    const lines = content.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeContent = '';
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code block handling
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={i} className="bg-gray-800 rounded-lg p-4 overflow-x-auto my-3 text-sm">
              <code className="text-green-300">{codeContent}</code>
            </pre>
          );
          codeContent = '';
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLanguage = line.slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent += (codeContent ? '\n' : '') + line;
        continue;
      }

      // Empty lines
      if (!line.trim()) {
        elements.push(<div key={i} className="h-2" />);
        continue;
      }

      // Headers
      if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className="text-2xl font-bold text-white mt-6 mb-3">{renderInline(line.slice(2))}</h1>);
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="text-xl font-semibold text-gray-200 mt-5 mb-2 border-b border-gray-700 pb-1">{renderInline(line.slice(3))}</h2>);
        continue;
      }
      if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="text-lg font-medium text-gray-300 mt-4 mb-1">{renderInline(line.slice(4))}</h3>);
        continue;
      }

      // Blockquotes (including contradiction warnings)
      if (line.startsWith('> ')) {
        const isWarning = line.includes('⚠️') || line.toLowerCase().includes('contradiction');
        elements.push(
          <blockquote key={i} className={`border-l-4 pl-4 py-1 my-2 ${
            isWarning ? 'border-yellow-500 bg-yellow-500/10 text-yellow-200' : 'border-gray-600 text-gray-400'
          }`}>
            {renderInline(line.slice(2))}
          </blockquote>
        );
        continue;
      }

      // Bullet points
      if (line.match(/^[\s]*[-*]\s/)) {
        const indent = line.match(/^(\s*)/)[1].length;
        elements.push(
          <div key={i} className="flex gap-2 text-gray-300 my-0.5" style={{ marginLeft: `${indent * 8 + 16}px` }}>
            <span className="text-gray-500">•</span>
            <span>{renderInline(line.replace(/^[\s]*[-*]\s/, ''))}</span>
          </div>
        );
        continue;
      }

      // Regular paragraph
      elements.push(<p key={i} className="text-gray-300 my-1">{renderInline(line)}</p>);
    }

    return elements;
  };

  // Render inline content: wiki-links, bold, italic, code
  const renderInline = (text) => {
    if (!text) return text;

    const parts = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Wiki links: [[slug]]
      const wikiMatch = remaining.match(/\[\[([^\]]+)\]\]/);
      // Bold: **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Inline code: `text`
      const codeMatch = remaining.match(/`([^`]+)`/);

      // Find the earliest match
      const matches = [
        wikiMatch && { type: 'wiki', match: wikiMatch },
        boldMatch && { type: 'bold', match: boldMatch },
        codeMatch && { type: 'code', match: codeMatch }
      ].filter(Boolean).sort((a, b) => a.match.index - b.match.index);

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0];
      const beforeText = remaining.substring(0, first.match.index);
      if (beforeText) parts.push(beforeText);

      if (first.type === 'wiki') {
        const slug = first.match[1];
        parts.push(
          <button
            key={`link-${key++}`}
            onClick={() => onWikiLinkClick(slug)}
            className="text-blue-400 hover:text-blue-300 underline decoration-dotted cursor-pointer"
          >
            {slug}
          </button>
        );
      } else if (first.type === 'bold') {
        parts.push(<strong key={`bold-${key++}`} className="text-white font-semibold">{first.match[1]}</strong>);
      } else if (first.type === 'code') {
        parts.push(<code key={`code-${key++}`} className="bg-gray-800 text-green-300 px-1.5 py-0.5 rounded text-sm">{first.match[1]}</code>);
      }

      remaining = remaining.substring(first.match.index + first.match[0].length);
    }

    return parts;
  };

  const categoryColors = {
    personal: 'bg-blue-500/20 text-blue-300',
    health: 'bg-green-500/20 text-green-300',
    work: 'bg-yellow-500/20 text-yellow-300',
    interests: 'bg-purple-500/20 text-purple-300',
    relationships: 'bg-pink-500/20 text-pink-300',
    goals: 'bg-orange-500/20 text-orange-300',
    habits: 'bg-teal-500/20 text-teal-300',
    media: 'bg-red-500/20 text-red-300',
    technology: 'bg-cyan-500/20 text-cyan-300',
    finance: 'bg-emerald-500/20 text-emerald-300',
    travel: 'bg-indigo-500/20 text-indigo-300',
    food: 'bg-amber-500/20 text-amber-300',
    general: 'bg-gray-500/20 text-gray-300'
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[page.category] || categoryColors.general}`}>
              {page.category}
            </span>
            <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              {page.type}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white">{page.title}</h1>
          <div className="text-sm text-gray-500 mt-1">
            Updated {formatDate(page.updatedAt, { includeTime: true })} · Created {formatDate(page.createdAt)}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="text-gray-500 hover:text-red-400 transition-colors p-2"
          title="Delete page"
        >
          🗑️
        </button>
      </div>

      {/* Links */}
      {(page.inboundLinks?.length > 0 || page.outboundLinks?.length > 0) && (
        <div className="bg-gray-900 rounded-lg p-4 mb-6 border border-gray-800">
          {page.inboundLinks?.length > 0 && (
            <div className="mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Linked from: </span>
              {page.inboundLinks.map(slug => (
                <button
                  key={slug}
                  onClick={() => onWikiLinkClick(slug)}
                  className="text-sm text-blue-400 hover:text-blue-300 mr-2"
                >
                  [[{slug}]]
                </button>
              ))}
            </div>
          )}
          {page.outboundLinks?.length > 0 && (
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Links to: </span>
              {page.outboundLinks.map(slug => (
                <button
                  key={slug}
                  onClick={() => onWikiLinkClick(slug)}
                  className="text-sm text-blue-400 hover:text-blue-300 mr-2"
                >
                  [[{slug}]]
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sources */}
      {(page.sourceNoteIds?.length > 0 || page.sourceChatIds?.length > 0) && (
        <div className="text-xs text-gray-500 mb-4 flex gap-4">
          {page.sourceNoteIds?.length > 0 && (
            <span>📝 {page.sourceNoteIds.length} note source{page.sourceNoteIds.length > 1 ? 's' : ''}</span>
          )}
          {page.sourceChatIds?.length > 0 && (
            <span>💬 {page.sourceChatIds.length} chat source{page.sourceChatIds.length > 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {/* Content */}
      <div className="prose prose-invert max-w-none">
        {renderContent(page.content)}
      </div>
    </div>
  );
};

export default WikiPageViewer;
