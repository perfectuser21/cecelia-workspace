/**
 * 最简单的测试页面 - 不使用 Tldraw
 * 只是一个红色方块，用来测试是否被覆盖
 */
import { useEffect, useState } from 'react';

export default function SimpleTest() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log('[SimpleTest] 组件已挂载');
    const timer = setInterval(() => {
      setCount(c => c + 1);
      console.log('[SimpleTest] 计数:', count);
    }, 1000);

    return () => {
      console.log('[SimpleTest] 组件将卸载!');
      clearInterval(timer);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'red',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      fontSize: 48,
      fontWeight: 'bold'
    }}>
      如果你能看到这个红色页面 {count} 秒，说明没有被覆盖
    </div>
  );
}
