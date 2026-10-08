import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import HTML from './html';
import { onSceneMessage, setSender } from './bridge';

/** Веб-превью: та же 3D-сцена в iframe. */
export default function Scene3D() {
  const ref = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (ref.current && e.source === ref.current.contentWindow && typeof e.data === 'string') onSceneMessage(e.data);
    };
    window.addEventListener('message', onMsg);
    setSender((m) => {
      const w: any = ref.current?.contentWindow;
      w?.game?.cmd(m);
    });
    return () => { window.removeEventListener('message', onMsg); setSender(null); };
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {React.createElement('iframe', { ref, srcDoc: HTML, style: { border: 0, width: '100%', height: '100%', pointerEvents: 'none', background: '#1b2a3a' } })}
    </View>
  );
}
