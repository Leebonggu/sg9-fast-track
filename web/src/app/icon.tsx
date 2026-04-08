import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: '96px',
          flexDirection: 'column',
        }}
      >
        <div style={{ color: 'white', fontSize: 160, fontWeight: 'bold', lineHeight: 1 }}>
          9
        </div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 48, fontWeight: 'bold', marginTop: 8 }}>
          SG
        </div>
      </div>
    ),
    { ...size }
  );
}
