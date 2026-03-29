import React, { SVGProps } from "react";

export const JFLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="14" cy="14" r="12.5" stroke="currentColor" strokeWidth="3" />
    <path
      d="M9 8L14 14L19 8"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M14 14V20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);
