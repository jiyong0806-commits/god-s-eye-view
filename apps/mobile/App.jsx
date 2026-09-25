import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

const SITE = 'https://godseyeview-c6q.pages.dev';
export default function App() {
  const web = useRef();
  const [failure, setFailure] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = request => {
    if (request.url === 'about:blank' || request.url.startsWith(`${SITE}/`)) return true;
    if (request.navigationType === 'click' && /^https:\/\//.test(request.url)) {
      Alert.alert('외부 링크', '기본 브라우저에서 열까요?', [
        { text: '취소', style: 'cancel' },
        { text: '열기', onPress: () => Linking.openURL(request.url).catch(() => {}) },
      ]);
    }
    return false;
  };
  return <SafeAreaProvider><SafeAreaView style={styles.screen}>
    <WebView ref={web} source={{ uri: `${SITE}/map/` }} style={styles.screen}
      originWhitelist={[SITE]} onShouldStartLoadWithRequest={navigate}
      javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction mixedContentMode="never"
      allowFileAccess={false} allowUniversalAccessFromFileURLs={false}
      onLoadStart={() => setLoading(true)} onLoadEnd={() => setLoading(false)}
      onError={() => { setFailure(true); setLoading(false); }}
      onHttpError={event => { if (event.nativeEvent.statusCode >= 500) setFailure(true); }}
      onContentProcessDidTerminate={() => { setFailure(true); setLoading(false); }} />
    {loading && !failure && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color="#80e7d1" /></View>}
    {failure && <View style={styles.error}><Text style={styles.text}>지도에 연결할 수 없습니다.</Text>
      <Pressable style={styles.retry} onPress={() => { setFailure(false); web.current?.reload(); }}><Text style={styles.text}>다시 연결</Text></Pressable>
    </View>}
  </SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080b10' },
  loading: { position: 'absolute', top: 14, right: 18, padding: 10 },
  error: { ...StyleSheet.absoluteFillObject, backgroundColor: '#080b10', alignItems: 'center', justifyContent: 'center', gap: 20 },
  text: { color: '#e6f0ee', fontSize: 16 },
  retry: { borderWidth: 1, borderColor: '#80e7d1', padding: 14, borderRadius: 6 },
});
