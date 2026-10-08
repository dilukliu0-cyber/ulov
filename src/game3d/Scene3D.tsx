import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import HTML from './html';
import { markError, onSceneMessage, setSender, scene3dOk } from './bridge';

/** Живая 3D-сцена на iPhone: WebGL в WKWebView (стабильнее expo-gl). */
export default function Scene3D() {
  const ref = useRef<WebView>(null);
  useEffect(() => {
    setSender((m) => {
      ref.current?.injectJavaScript(`window.game&&window.game.cmd(${JSON.stringify(m)});true;`);
    });
    // если сцена не поднялась за 15 с — показываем запасную картинку
    const to = setTimeout(() => { if (!scene3dOk()) markError('3D timeout'); }, 15000);
    return () => { clearTimeout(to); setSender(null); };
  }, []);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView
        ref={ref}
        source={{ html: HTML, baseUrl: 'https://ulov.local/' }}
        originWhitelist={['*']}
        style={{ flex: 1, backgroundColor: '#1b2a3a' }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onMessage={(e) => onSceneMessage(e.nativeEvent.data)}
        onError={(e) => markError('webview: ' + e.nativeEvent.description)}
        onContentProcessDidTerminate={() => { markError('3D process terminated'); ref.current?.reload(); }}
        setSupportMultipleWindows={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
      />
    </View>
  );
}
