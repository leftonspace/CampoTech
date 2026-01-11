'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Paperclip,
  Clock,
  FileText,
  Image as ImageIcon,
  Mic,
} from 'lucide-react';
import { EmojiButton } from './EmojiPicker';

interface MessageInputProps {
  isInWindow: boolean;
  isSending: boolean;
  onSend: (text: string) => void;
  onSendTemplate: () => void;
  onAttachment?: (file: File) => void;
  // Controlled input props for copilot suggestions
  value?: string;
  onChange?: (value: string) => void;
}

export default function MessageInput({
  isInWindow,
  isSending,
  onSend,
  onSendTemplate,
  onAttachment,
  value,
  onChange,
}: MessageInputProps) {
  const [internalText, setInternalText] = useState('');

  // Use controlled value if provided, otherwise use internal state
  const text = value !== undefined ? value : internalText;
  const setText = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
    } else {
      setInternalText(newValue);
    }
  };
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [text]);

  const handleSend = () => {
    if (!text.trim() || !isInWindow || isSending) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (type: string) => {
    const input = document.createElement('input');
    input.type = 'file';

    switch (type) {
      case 'image':
        input.accept = 'image/*';
        break;
      case 'document':
        input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
        break;
      case 'audio':
        input.accept = 'audio/*';
        break;
    }

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && onAttachment) {
        onAttachment(file);
      }
    };

    input.click();
    setShowAttachMenu(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    // Insert emoji at cursor position
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);

      // Set cursor position after emoji
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + emoji.length;
          textareaRef.current.selectionEnd = start + emoji.length;
          textareaRef.current.focus();
        }
      }, 0);
    } else {
      setText(text + emoji);
    }
  };

  return (
    <div className="p-4 border-t bg-white">
      {/* Outside window warning */}
      {!isInWindow && (
        <div className="mb-3 p-3 bg-warning-50 border border-warning-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Clock className="h-5 w-5 text-warning-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-warning-700 font-medium">
                Fuera de la ventana de 24 horas
              </p>
              <p className="text-sm text-warning-600 mt-0.5">
                Solo podes enviar mensajes de template pre-aprobados.
              </p>
              <button
                onClick={onSendTemplate}
                className="text-sm text-primary-600 hover:underline mt-2 inline-flex items-center gap-1"
              >
                <FileText className="h-4 w-4" />
                Enviar template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* Attachment button */}
        <div className="relative">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            disabled={!isInWindow}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          {/* Attachment menu */}
          {showAttachMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowAttachMenu(false)}
              />
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border rounded-lg shadow-lg z-20">
                <button
                  onClick={() => handleFileSelect('image')}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <ImageIcon className="h-4 w-4 text-primary-500" />
                  Imagen
                </button>
                <button
                  onClick={() => handleFileSelect('document')}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText className="h-4 w-4 text-primary-500" />
                  Documento
                </button>
                <button
                  onClick={() => handleFileSelect('audio')}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <Mic className="h-4 w-4 text-primary-500" />
                  Audio
                </button>
              </div>
            </>
          )}
        </div>

        {/* Emoji button */}
        {isInWindow && (
          <EmojiButton onSelect={handleEmojiSelect} />
        )}

        {/* Text input */}
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isInWindow
                ? 'Escribi un mensaje...'
                : 'Solo templates fuera de la ventana 24h'
            }
            disabled={!isInWindow}
            className="w-full px-4 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            rows={1}
          />
        </div>

        {/* Template button (when outside window) */}
        {!isInWindow && (
          <button
            onClick={onSendTemplate}
            className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
            title="Enviar template"
          >
            <FileText className="h-5 w-5" />
          </button>
        )}

        {/* Send button */}
        {isInWindow && (
          <button
            onClick={handleSend}
            disabled={!text.trim() || isSending}
            className="p-2 bg-success-500 text-white rounded-lg hover:bg-success-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
