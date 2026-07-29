import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

export const HomeFilled: React.FC<IconProps> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M3,10a2,2 0 0,1 0.709,-1.528l7,-5.992a2,2 0 0,1 2.582,0l7,5.992A2,2 0 0,1 21,10v9a2,2 0 0,1 -2,2H5a2,2 0 0,1 -2,-2z M15,21v-8a1,1 0 0,0 -1,-1h-4a1,1 0 0,0 -1,1v8z" />
  </svg>
);

export const WrenchFilled: React.FC<IconProps> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M232,96a72,72,0,0,1-100.94,66L79,222.22c-.12.14-.26.29-.39.42a32,32,0,0,1-45.26-45.26c.14-.13.28-.27.43-.39L94,124.94a72.07,72.07,0,0,1,83.54-98.78,8,8,0,0,1,3.93,13.19L144,80l5.66,26.35L176,112l40.65-37.52a8,8,0,0,1,13.19,3.93A72.6,72.6,0,0,1,232,96Z"/>
  </svg>
);

export const BoxFilled: React.FC<IconProps> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M223.68,66.15,135.68,18a15.88,15.88,0,0,0-15.36,0l-88,48.17a16,16,0,0,0-8.32,14v95.64a16,16,0,0,0,8.32,14l88,48.17a15.88,15.88,0,0,0,15.36,0l88-48.17a16,16,0,0,0,8.32-14V80.18A16,16,0,0,0,223.68,66.15ZM128,32l80.35,44L178.57,92.29l-80.35-44Zm0,88L47.65,76,81.56,57.43l80.35,44Zm88,55.85h0l-80,43.79V133.83l32-17.51V152a8,8,0,0,0,16,0V107.56l32-17.51v85.76Z"/>
  </svg>
);

export const RoutingFilled: React.FC<IconProps> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M224,64a32,32,0,1,0-40,31v17a8,8,0,0,1-8,8H80a8,8,0,0,1-8-8V95a32,32,0,1,0-16,0v17a24,24,0,0,0,24,24h40v25a32,32,0,1,0,16,0V136h40a24,24,0,0,0,24-24V95A32.06,32.06,0,0,0,224,64ZM144,192a16,16,0,1,1-16-16A16,16,0,0,1,144,192Z"/>
  </svg>
);

export const SpeedometerFilled: React.FC<IconProps> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M221.87,90.86a4,4,0,0,0-6.17-.62l-75.42,75.42A8,8,0,0,1,129,154.35l92.7-92.69a8,8,0,0,0-11.32-11.32L197,63.73A112.05,112.05,0,0,0,22.34,189.25,16.09,16.09,0,0,0,37.46,200H218.53a16,16,0,0,0,15.11-10.71,112.28,112.28,0,0,0-11.77-98.43ZM57.44,166.41a8,8,0,0,1-6.25,9.43,7.89,7.89,0,0,1-1.6.16,8,8,0,0,1-7.83-6.41A88.06,88.06,0,0,1,143.59,65.38a8,8,0,0,1-2.82,15.75,72.07,72.07,0,0,0-83.33,85.28Z"/>
  </svg>
);

export const CloudFilled: React.FC<IconProps> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 26 26" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(1 1)">
      <path d="M19.35,10.04C18.67,6.59 15.64,4 12,4C9.11,4 6.6,5.64 5.35,8.04C2.34,8.36 0,10.91 0,14c0,3.31 2.69,6 6,6h13c2.76,0 5,-2.24 5,-5c0,-2.64 -2.05,-4.78 -4.65,-4.96zM17,13h-3V9h-4v4H7l5,5l5,-5z" />
    </g>
  </svg>
);

export const BrushFilled: React.FC<IconProps> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M232,32a8,8,0,0,0-8-8c-44.08,0-89.31,49.71-114.43,82.63A60,60,0,0,0,32,164c0,30.88-19.54,44.73-20.47,45.37A8,8,0,0,0,16,224H92a60,60,0,0,0,57.37-77.57C182.3,121.31,232,76.08,232,32ZM124.42,113.55q5.14-6.66,10.09-12.55A76.23,76.23,0,0,1,155,121.49q-5.9,4.94-12.55,10.09A60.54,60.54,0,0,0,124.42,113.55Zm42.7-2.68a92.57,92.57,0,0,0-22-22c31.78-34.53,55.75-45,69.9-47.91C212.17,55.12,201.65,79.09,167.12,110.87Z"/>
  </svg>
);

export const LanguageFilled: React.FC<IconProps> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12,2C6.48,2 2,6.48 2,12s4.48,10 10,10 10,-4.48 10,-10S17.52,2 12,2zm-1,17.93c-3.95,-0.49 -7,-3.85 -7,-7.93c0,-0.62 0.08,-1.21 0.21,-1.79L9,15v1c0,1.1 0.9,2 2,2v1.93zm6.9,-2.53c-0.26,-0.81 -1,-1.4 -1.9,-1.4h-1v-3c0,-0.55 -0.45,-1 -1,-1h-6v-2h2c0.55,0 1,-0.45 1,-1V7h2c1.1,0 2,-0.9 2,-2v-0.41c2.93,1.19 5,4.06 5,7.41c0,2.08 -0.8,3.97 -2.1,5.4z"/>
  </svg>
);

export const AppsFilled: React.FC<IconProps> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M4,4h6v6H4V4z M14,4h6v6h-6V4z M4,14h6v6H4V14z M14,14h6v6h-6V14z" />
  </svg>
);

export const InfoFilled: React.FC<IconProps> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
  </svg>
);

export const CloseFilled: React.FC<IconProps> = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
  </svg>
);
