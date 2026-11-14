import React from 'react';
import { Check, Volume2 } from 'lucide-react';
import type { OptionColor, QuestionOption, QuestionType } from '../types.ts';
import { resolveMediaUrl, speakVietnameseText } from '../utils/api.ts';
import { MathText } from './MathText.tsx';

const COLOR_STYLES: Record<
  OptionColor,
  { bg: string; hover: string; border: string; shapeLabel: string; renderShape: () => React.ReactNode }
> = {
  RED: {
    bg: 'bg-[#E21B3C]',
    hover: 'hover:bg-rose-500',
    border: 'border-rose-400',
    shapeLabel: 'Tam giác',
    renderShape: () => (
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current shrink-0">
        <polygon points="12,3 22,20 2,20" />
      </svg>
    ),
  },
  BLUE: {
    bg: 'bg-[#1368CE]',
    hover: 'hover:bg-blue-500',
    border: 'border-blue-400',
    shapeLabel: 'Hình thoi',
    renderShape: () => (
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current shrink-0">
        <polygon points="12,2 22,12 12,22 2,12" />
      </svg>
    ),
  },
  YELLOW: {
    bg: 'bg-[#D89E00]',
    hover: 'hover:bg-amber-400',
    border: 'border-amber-300',
    shapeLabel: 'Hình tròn',
    renderShape: () => (
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current shrink-0">
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  GREEN: {
    bg: 'bg-[#26890C]',
    hover: 'hover:bg-emerald-500',
    border: 'border-emerald-400',
    shapeLabel: 'Hình vuông',
    renderShape: () => (
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current shrink-0">
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>
    ),
  },
};

interface AnswerGridProps {
  options: QuestionOption[];
  questionType: QuestionType;
  selectedIds: string[];
  onToggleOption?: (optionId: string) => void;
  disabled?: boolean;
  revealCorrectIds?: string[];
  optionCounts?: Record<string, number>;
  hideText?: boolean;
  preschoolMode?: boolean;
}

export const AnswerGrid: React.FC<AnswerGridProps> = ({
  options,
  questionType,
  selectedIds,
  onToggleOption,
  disabled = false,
  revealCorrectIds,
  optionCounts,
  hideText = false,
  preschoolMode = false,
}) => {
  const isRevealed = Array.isArray(revealCorrectIds);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
      {options.map((opt, idx) => {
        const colors: OptionColor[] = ['RED', 'BLUE', 'YELLOW', 'GREEN'];
        const colorKey = COLOR_STYLES[opt.color] ? opt.color : colors[idx % 4];
        const theme = COLOR_STYLES[colorKey];
        const isSelected = selectedIds.includes(opt.id);
        const isCorrect = isRevealed ? revealCorrectIds.includes(opt.id) : Boolean(opt.isCorrect);

        let opacityClass = 'opacity-100';
        if (isRevealed && !isCorrect) {
          opacityClass = 'opacity-40 saturate-50';
        }

        const hasVisual = Boolean(opt.sticker || opt.imageUrl);

        return (
          <div
            key={opt.id}
            onClick={() => {
              if (!disabled) onToggleOption?.(opt.id);
            }}
            className={`relative flex items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl text-white font-extrabold text-left transition-all kahoot-shadow ${
              !disabled ? 'cursor-pointer ' + theme.hover : 'cursor-default'
            } ${theme.bg} ${opacityClass} ${
              isSelected ? 'ring-4 ring-white scale-[1.01]' : ''
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-2xl bg-black/20 flex items-center justify-center shrink-0">
                {theme.renderShape()}
              </div>

              {/* Giant Preschool Sticker or Image */}
              {opt.sticker && (
                <span className="text-4xl sm:text-6xl leading-none select-none shrink-0 drop-shadow-md">
                  {opt.sticker}
                </span>
              )}
              {opt.imageUrl && (
                <img
                  src={resolveMediaUrl(opt.imageUrl)}
                  alt={opt.text}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover bg-white/90 p-1 shrink-0"
                />
              )}

              {!hideText && opt.text ? (
                <div
                  className={`${
                    hasVisual || preschoolMode ? 'text-lg sm:text-2xl' : 'text-base sm:text-xl'
                  } leading-snug break-words`}
                >
                  <MathText text={opt.text} />
                </div>
              ) : (
                <div className="text-base sm:text-lg uppercase tracking-wider opacity-90">
                  {theme.shapeLabel}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Read aloud button for preschool children */}
              {opt.text && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakVietnameseText(opt.text);
                  }}
                  className="p-2 rounded-xl bg-black/25 hover:bg-black/40 text-white"
                  title="Đọc to đáp án này cho bé nghe"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              )}

              {questionType === 'MULTIPLE_CHOICE' && !isRevealed && (
                <div
                  className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center ${
                    isSelected ? 'bg-white text-slate-900 border-white' : 'border-white/70 bg-black/20'
                  }`}
                >
                  {isSelected && <Check className="w-5 h-5 stroke-[3]" />}
                </div>
              )}

              {isRevealed && isCorrect && (
                <span className="px-2.5 py-1 rounded-xl bg-white text-emerald-700 text-xs font-black flex items-center gap-1 shadow">
                  <Check className="w-4 h-4 stroke-[3]" /> ĐÚNG
                </span>
              )}

              {optionCounts && optionCounts[opt.id] !== undefined && (
                <span className="px-3 py-1 rounded-xl bg-black/35 text-white text-sm font-black">
                  {optionCounts[opt.id]} lượt
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
