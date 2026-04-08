import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2F5496',
          borderRadius: '36px',
          flexDirection: 'column',
        }}
      >
        <div style={{ color: 'white', fontSize: 80, fontWeight: 'bold', lineHeight: 1 }}>
          9
        </div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
          SG
        </div>
      </div>
    ),
    { ...size }
  );
}
