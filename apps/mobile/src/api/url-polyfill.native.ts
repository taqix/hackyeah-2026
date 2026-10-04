// supabase-js builds its endpoints with `new URL(path, base)` and reads
// searchParams, which React Native's own URL does not fully implement.
import 'react-native-url-polyfill/auto';
