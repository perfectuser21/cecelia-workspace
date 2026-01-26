/**
 * Tldraw v3.x 测试页面
 */
import { useEffect, useState } from 'react';
import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';

export default function VoiceCanvasTest() {
  const [canvasStatus, setCanvasStatus] = useState('加载中...');

  useEffect(() => {
    console.log('[VoiceCanvasTest] Tldraw v3.x 测试');

    const interval = setInterval(() => {
      const tlCanvas = document.querySelector('.tl-canvas');
      const status = tlCanvas ? '✅ Canvas正常 (v3.x)' : '❌ Canvas消失';
      setCanvasStatus(status);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
    }}>
      {/* 状态指示器 */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        padding: 12,
        backgroundColor: 'rgba(0,0,0,0.8)',
        color: 'lime',
        fontSize: 14,
        zIndex: 999999,
        borderRadius: 6,
      }}>
        {canvasStatus}
      </div>

      {/* Tldraw */}
      <Tldraw />
    </div>
  );
}
