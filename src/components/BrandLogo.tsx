import React from 'react';

export const BrandLogo: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1B4332] text-[#FAF8F4] border border-[#2D6A4F]">
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M4.5 7.5C3 7.5 2 6.5 2 5C3.5 5 5 5.8 6 7L7.5 6.5C9.5 5.8 14.5 5.8 16.5 6.5L18 7C19 5.8 20.5 5 22 5C22 6.5 21 7.5 19.5 7.5L18.5 12.5C18.1 16 15.6 19 12 19C8.4 19 5.9 16 5.5 12.5L4.5 7.5Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <circle cx="9.5" cy="11.5" r="1" fill="#B7C99C" />
          <circle cx="14.5" cy="11.5" r="1" fill="#B7C99C" />
          <path d="M12 14.5V16.5" stroke="#B7C99C" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="19.5" cy="10" r="1.7" fill="#B7C99C" />
        </svg>
      </div>
      {!collapsed && (
        <div className="leading-tight min-w-0">
          <div className="font-display text-[15px] font-bold tracking-tight text-[#1F2421] whitespace-nowrap">
            DairyMitra AI 2.0
          </div>
          <div className="text-[11px] font-medium text-[#7A827E] whitespace-nowrap">
            Smart Dairy Suite
          </div>
        </div>
      )}
    </div>
  );
};
