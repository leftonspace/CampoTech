'use client';

import { useState, useRef, useEffect } from 'react';
import { Smile, Search, X } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

// Common emoji categories with frequently used emojis
const EMOJI_CATEGORIES = {
  'Frecuentes': ['👍', '❤️', '😊', '😂', '🙏', '👌', '✅', '🎉', '💪', '🔥', '👏', '😍'],
  'Emociones': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
  'Gestos': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪'],
  'Objetos': ['📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '📷', '📹', '🎥', '📺', '📻', '🎙️', '⏰', '⏱️', '📅', '📆', '🗓️', '📌', '📍', '🔧', '🔨', '⚙️', '🔩', '🔑', '🗝️', '📦', '📫', '📮', '✉️', '📧', '📝', '📄', '📋', '📁', '📂', '🗂️', '📊', '📈', '📉'],
  'Simbolos': ['✅', '❌', '❓', '❗', '💯', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🔶', '🔷', '💬', '💭', '🗨️', '♥️', '💛', '💚', '💙', '💜', '🖤', '🤍', '⭐', '🌟', '✨', '💫', '⚡', '🔔', '🎵', '🎶', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️'],
  'Trabajo': ['💼', '📊', '📈', '📉', '📋', '📁', '📂', '🗄️', '📆', '📅', '🗓️', '📇', '🗃️', '🗳️', '📌', '📍', '🖇️', '📎', '✂️', '📏', '📐', '✏️', '📝', '🖊️', '🖋️', '✒️', '🔍', '🔎', '🔐', '🔒', '🔓', '💡', '🏆', '🎯', '📣', '📢'],
};

export default function EmojiPicker({ onSelect, isOpen, onClose }: EmojiPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Frecuentes');
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter emojis based on search
  const getFilteredEmojis = () => {
    if (!searchQuery.trim()) {
      return EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES] || [];
    }

    // When searching, search all categories
    const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
    // Since we can't search by name without a library, just return all for now
    // In production, you'd use a library like emoji-mart for proper search
    return allEmojis;
  };

  const filteredEmojis = getFilteredEmojis();
  const categories = Object.keys(EMOJI_CATEGORIES);

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 mb-2 w-80 bg-white border rounded-lg shadow-lg z-30"
    >
      {/* Header */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar emoji..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {!searchQuery && (
        <div className="flex overflow-x-auto p-1 border-b scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-2 py-1 text-xs font-medium whitespace-nowrap rounded ${
                activeCategory === category
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="p-2 h-48 overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {filteredEmojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded transition-colors"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>

        {filteredEmojis.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No se encontraron emojis
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t text-xs text-gray-500 text-center">
        Haz clic en un emoji para insertarlo
      </div>
    </div>
  );
}

// Emoji button component for use in MessageInput
export function EmojiButton({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:bg-gray-100 rounded"
        title="Insertar emoji"
      >
        <Smile className="h-5 w-5" />
      </button>

      <EmojiPicker
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={onSelect}
      />
    </div>
  );
}
