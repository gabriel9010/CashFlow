// App.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  useWindowDimensions,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { ResponseType, makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// ================== CONFIG ==================
const API_BASE_URL = 'https://backend.onrender.com';
const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';

WebBrowser.maybeCompleteAuthSession();

// ================== TIPI ==================
type TxType = 'entrata' | 'uscita';
type Transaction = {
  id: string;
  _id?: string;
  type: TxType;
  amount: number;
  category: string;
  note?: string;
  date: number;
};
type ThemeMode = 'system' | 'light' | 'dark';
type TabKey = 'home' | 'movimenti' | 'grafici' | 'impostazioni' | 'account';

// ================== RESPONSIVE ==================
const GUIDELINE_BASE_WIDTH = 390;
const GUIDELINE_BASE_HEIGHT = 844;
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const makeScaler = (w: number, h: number) => {
  const scaleW = w / GUIDELINE_BASE_WIDTH;
  const scaleH = h / GUIDELINE_BASE_HEIGHT;
  const scale = clamp(Math.min(scaleW, scaleH), 0.85, 1.35);
  const fontScale = clamp(Math.min(scaleW, scaleH) * 0.95, 0.88, 1.25);
  return { rs: (n: number) => Math.round(n * scale), fs: (n: number) => Math.round(n * fontScale) };
};

// ================== TEMA ==================
const LIGHT = {
  bg: '#F7F9FC',
  card: 'rgba(0,0,0,0.04)',
  cardBr: 'rgba(0,0,0,0.08)',
  text: '#0B1320',
  subtext: '#5A677A',
  green: '#2EC4B6',
  red: '#FF6B6B',
  yellow: '#FFC857',
  blue: '#3A86FF',
  overlay: 'rgba(0,0,0,0.15)',
};
const DARK = {
  bg: '#0D1117',
  card: 'rgba(255,255,255,0.06)',
  cardBr: 'rgba(255,255,255,0.12)',
  text: '#E6EDF3',
  subtext: '#94A3B8',
  green: '#3DDC97',
  red: '#FF6B6B',
  yellow: '#FFD166',
  blue: '#6EA8FE',
  overlay: 'rgba(0,0,0,0.45)',
};

// ================== UTILS ==================
const fmtMoney = (v: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);
const niceDate = (t: number) =>
  new Date(t).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return +d;
};
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const normalizePhone = (raw: string) => raw.replace(/\s+/g, '').trim(); // es: "+393331112233"

const CATEGORIES = {
  entrata: ['Stipendio', 'Freelance', 'Vendite', 'Rimborsi', 'Altro'],
  uscita: ['Affitto', 'Spesa', 'Trasporti', 'Ristoranti', 'Abbonamenti', 'Shopping', 'Altro'],
};

// ================== ROOT ==================
export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

// ================== APP ==================
function AppInner() {
  const insets = useSafeAreaInsets();

  // Tema
  const deviceScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const scheme: 'light' | 'dark' =
    themeMode === 'system' ? (deviceScheme === 'dark' ? 'dark' : 'light') : themeMode;
  const COLORS = scheme === 'dark' ? DARK : LIGHT;

  // Responsive
  const { width, height } = useWindowDimensions();
  const { rs, fs } = useMemo(() => makeScaler(width, height), [width, height]);

  // Stato base (APP)
  const [tab, setTab] = useState<TabKey>('home');
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<TxType | 'tutte'>('tutte');

  const [modalOpen, setModalOpen] = useState(false);
  const [formType, setFormType] = useState<TxType>('entrata');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formNote, setFormNote] = useState('');

  // Account/Auth
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  const [importText, setImportText] = useState('');
  const [booting, setBooting] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);

  // OTP (solo register)
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [phoneProofToken, setPhoneProofToken] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);

  // Persistenza
  const SAVE_KEY = 'CF1_TXS_CACHE';
  const PREF_KEY = 'CF1_PREFS';
  const TOKEN_KEY = 'CF1_TOKEN';
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs per focus (migliora UX + evita overlap con scroll)
  const loginScrollRef = useRef<ScrollView | null>(null);
  const modalScrollRef = useRef<ScrollView | null>(null);

  const emailRef = useRef<TextInput | null>(null);
  const pwdRef = useRef<TextInput | null>(null);
  const phoneRef = useRef<TextInput | null>(null);
  const otpRef = useRef<TextInput | null>(null);

  const amountRef = useRef<TextInput | null>(null);
  const noteRef = useRef<TextInput | null>(null);

  // Google Auth
  const redirectUri = makeRedirectUri({ useProxy: true });
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    responseType: ResponseType.IdToken,
    scopes: ['profile', 'email'],
    selectAccount: true,
    redirectUri,
  });

  useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) {
      handleGoogleIdToken(response.params.id_token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  // Reset OTP quando cambi tab auth o email
  useEffect(() => {
    setOtp('');
    setOtpSent(false);
    setOtpVerified(false);
    setPhoneProofToken(null);
  }, [authMode]);

  // Load iniziale
  useEffect(() => {
    (async () => {
      try {
        const prefRaw = await AsyncStorage.getItem(PREF_KEY);
        if (prefRaw) {
          const p = JSON.parse(prefRaw) as { themeMode?: ThemeMode; email?: string; lastTab?: TabKey };
          if (p.themeMode) setThemeMode(p.themeMode);
          if (p.email) setEmail(p.email);
          if (p.lastTab) setTab(p.lastTab);
        }

        const tok = await AsyncStorage.getItem(TOKEN_KEY);
        if (tok) {
          setToken(tok);

          const raw = await AsyncStorage.getItem(SAVE_KEY);
          if (raw) setTxs(JSON.parse(raw));

          await syncFromServer(tok);
        }
      } catch {
        // ignore
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist cache txs (solo se loggato)
  useEffect(() => {
    if (!token) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(SAVE_KEY, JSON.stringify(txs)).catch(() => {});
    }, 250);
  }, [txs, token]);

  // Persist prefs
  useEffect(() => {
    AsyncStorage.setItem(PREF_KEY, JSON.stringify({ themeMode, email, lastTab: tab })).catch(() => {});
  }, [themeMode, email, tab]);

  // Derivati
  const { totalEntrate, totalUscite, saldo } = useMemo(() => {
    const e = txs.filter(t => t.type === 'entrata').reduce((a, b) => a + b.amount, 0);
    const u = txs.filter(t => t.type === 'uscita').reduce((a, b) => a + b.amount, 0);
    return { totalEntrate: e, totalUscite: u, saldo: e - u };
  }, [txs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txs
      .filter(t => (filterType === 'tutte' ? true : t.type === filterType))
      .filter(t => (q ? `${t.category} ${t.note ?? ''}`.toLowerCase().includes(q) : true))
      .sort((a, b) => b.date - a.date);
  }, [txs, query, filterType]);

  const last7DaysChart = useMemo(() => {
    const days = [...Array(7)].map((_, i) => {
      const dayStart = startOfDay(Date.now() - (6 - i) * 86400000);
      const list = txs.filter(t => t.date >= dayStart && t.date < dayStart + 86400000);
      const pos = list.filter(t => t.type === 'entrata').reduce((a, b) => a + b.amount, 0);
      const neg = list.filter(t => t.type === 'uscita').reduce((a, b) => a + b.amount, 0);
      return {
        label: new Date(dayStart).toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase(),
        pos,
        neg,
      };
    });
    const max = Math.max(1, ...days.map(d => Math.max(d.pos, d.neg)));
    return days.map(d => ({ ...d, posH: d.pos / max, negH: d.neg / max }));
  }, [txs]);

  const monthly = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      map.set(monthKey(d), { in: 0, out: 0 });
    }
    txs.forEach(t => {
      const d = new Date(t.date);
      const k = monthKey(new Date(d.getFullYear(), d.getMonth(), 1));
      if (!map.has(k)) return;
      const item = map.get(k)!;
      if (t.type === 'entrata') item.in += t.amount;
      else item.out += t.amount;
    });
    const entries = [...map.entries()].map(([k, v]) => {
      const [Y, M] = k.split('-').map(Number);
      const label = new Date(Y, M - 1, 1).toLocaleDateString('it-IT', { month: 'short' });
      return { label: label.toUpperCase(), ...v };
    });
    const max = Math.max(1, ...entries.map(e => Math.max(e.in, e.out)));
    return entries.map(e => ({ ...e, inH: e.in / max, outH: e.out / max }));
  }, [txs]);

  const byCategory = useMemo(() => {
    const agg: Record<string, number> = {};
    txs.forEach(t => {
      const k = `${t.type}:${(t.category || 'Altro').trim()}`;
      agg[k] = (agg[k] || 0) + t.amount;
    });
    const asArr = Object.entries(agg).map(([k, v]) => {
      const [type, cat] = k.split(':');
      return { type: type as TxType, category: cat, total: v };
    });
    const top = asArr.sort((a, b) => b.total - a.total).slice(0, 8);
    const sum = top.reduce((a, b) => a + b.total, 0) || 1;
    return top.map(x => ({ ...x, pct: x.total / sum }));
  }, [txs]);

  // ================== API HELPERS ==================
  const authHeader = (tok?: string) => ({
    'Content-Type': 'application/json',
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
  });

  // OTP
  const requestOtp = async (phoneE164: string) => {
    const r = await fetch(`${API_BASE_URL}/auth/request-otp`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ phone: phoneE164 }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'otp_request_failed');
    return j;
  };

  const verifyOtp = async (phoneE164: string, code: string) => {
    const r = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ phone: phoneE164, code }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'otp_verify_failed');
    return j as { ok: true; phoneProofToken: string };
  };

  /**
   * ✅ Registrazione aggiornata: ora backend NON ritorna token.
   * Atteso: { ok: true, needsEmailVerification: true }
   */
  const register = async (emailV: string, password: string, phoneE164: string, proof: string) => {
    const r = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ email: emailV, password, phone: phoneE164, phoneProofToken: proof }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'register_failed');
    return j as { ok: true; needsEmailVerification?: boolean };
  };

  /**
   * ✅ Login aggiornato: può fallire con email_not_verified
   */
  const login = async (emailV: string, password: string) => {
    const r = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ email: emailV, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'login_failed');
    return j as { token: string; user: { id: string; email: string } };
  };

  /**
   * ✅ Google login aggiornato: può fallire con need_phone_verification oppure email_not_verified
   */
  const googleLogin = async (idToken: string) => {
    const r = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ idToken }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'google_login_failed');
    return j as { token: string; user: { id: string; email: string } };
  };

  const syncFromServer = async (tok: string) => {
    try {
      setIsLoadingSync(true);
      const r = await fetch(`${API_BASE_URL}/tx`, { headers: authHeader(tok) });
      if (!r.ok) throw new Error('sync_failed');
      const data = await r.json();
      const serverTxs: Transaction[] = (data.txs ?? []).map((t: any) => ({
        id: t._id,
        _id: t._id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        note: t.note,
        date: t.date,
      }));
      setTxs(serverTxs.sort((a, b) => b.date - a.date));
    } catch (e) {
      console.log('Sync error', e);
    } finally {
      setIsLoadingSync(false);
    }
  };

  const createTxServer = async (tok: string, tx: Omit<Transaction, 'id' | '_id'>) => {
    const r = await fetch(`${API_BASE_URL}/tx`, {
      method: 'POST',
      headers: authHeader(tok),
      body: JSON.stringify(tx),
    });
    if (!r.ok) throw new Error('create_failed');
    const data = await r.json();
    return data.tx as any;
  };

  const deleteTxServer = async (tok: string, id: string) => {
    const r = await fetch(`${API_BASE_URL}/tx/${id}`, { method: 'DELETE', headers: authHeader(tok) });
    if (!r.ok) throw new Error('delete_failed');
  };

  const exportFromServer = async (tok: string) => {
    const r = await fetch(`${API_BASE_URL}/export`, { headers: authHeader(tok) });
    if (!r.ok) throw new Error('export_failed');
    return r.json();
  };

  const importToServer = async (tok: string, payload: any) => {
    const r = await fetch(`${API_BASE_URL}/import`, {
      method: 'POST',
      headers: authHeader(tok),
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error('import_failed');
    return r.json();
  };

  // ================== SCROLL HELPERS (no keyboard overlap) ==================
  const scrollToInput = (scrollRef: React.RefObject<ScrollView | null>, y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - rs(24)), animated: true });
    });
  };

  // ================== ACTIONS (AUTH) ==================
  const handleGoogleIdToken = async (idToken: string) => {
    try {
      setAuthBusy(true);
      const data = await googleLogin(idToken);
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setEmail(data.user?.email ?? '');
      await syncFromServer(data.token);
      setTab('home');
      Keyboard.dismiss();
      Alert.alert('Benvenuto', 'Accesso con Google riuscito!');
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('need_phone_verification')) {
        Alert.alert('Verifica richiesta', 'Per il primo accesso devi creare l’account con telefono + OTP + email verificata.');
      } else if (msg.includes('email_not_verified')) {
        Alert.alert('Email non verificata', 'Verifica la tua email (link ricevuto) e poi riprova.');
      } else {
        Alert.alert('Errore', 'Login Google fallito.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const doSendOtp = async () => {
    const p = normalizePhone(phone);
    if (!p || !p.startsWith('+')) {
      Alert.alert('Numero non valido', 'Inserisci il numero in formato internazionale, es: +393331112233');
      return;
    }
    try {
      setOtpBusy(true);
      await requestOtp(p);
      setOtpSent(true);
      setOtpVerified(false);
      setPhoneProofToken(null);
      Alert.alert('OTP inviato', 'Controlla l’SMS e inserisci il codice.');
      setTimeout(() => otpRef.current?.focus(), 250);
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      Alert.alert('Errore OTP', msg.includes('too_many_requests') ? 'Troppi tentativi. Riprova tra poco.' : 'Invio OTP fallito.');
    } finally {
      setOtpBusy(false);
    }
  };

  const doVerifyOtp = async () => {
    const p = normalizePhone(phone);
    if (!p || !p.startsWith('+')) {
      Alert.alert('Numero non valido', 'Inserisci il numero in formato internazionale, es: +39...');
      return;
    }
    if (!otp || otp.length < 4) {
      Alert.alert('Codice non valido', 'Inserisci il codice ricevuto via SMS.');
      return;
    }
    try {
      setOtpBusy(true);
      const res = await verifyOtp(p, otp.trim());
      setPhoneProofToken(res.phoneProofToken);
      setOtpVerified(true);
      Keyboard.dismiss();
      Alert.alert('OK', 'Numero verificato ✅');
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      Alert.alert('OTP errato', msg.includes('too_many_requests') ? 'Troppi tentativi. Riprova tra poco.' : 'Codice non valido.');
    } finally {
      setOtpBusy(false);
    }
  };

  const doAuth = async () => {
    if (authBusy) return;
    try {
      if (!email || !pwd) {
        Alert.alert('Compila email e password');
        return;
      }

      setAuthBusy(true);

      if (authMode === 'register') {
        const p = normalizePhone(phone);
        if (!p || !p.startsWith('+')) {
          Alert.alert('Telefono richiesto', 'Inserisci il numero in formato internazionale, es: +393...');
          return;
        }
        if (!otpVerified || !phoneProofToken) {
          Alert.alert('Verifica richiesta', 'Devi verificare il numero via OTP prima di creare l’account.');
          return;
        }

        // ✅ ora non logga: manda email di verifica
        const resp = await register(email, pwd, p, phoneProofToken);
        Keyboard.dismiss();

        if (resp?.needsEmailVerification) {
          Alert.alert(
            'Verifica email',
            'Ti abbiamo inviato una mail con un pulsante di verifica.\n\nDopo la verifica, torna qui e fai login.'
          );
        } else {
          // fallback
          Alert.alert('Quasi fatto', 'Controlla la tua email per completare la registrazione.');
        }

        setAuthMode('login');
        setPwd('');
        return;
      }

      // login classico
      const resp = await login(email, pwd);
      await AsyncStorage.setItem(TOKEN_KEY, resp.token);
      setToken(resp.token);
      setEmail(resp.user?.email ?? email);
      await syncFromServer(resp.token);
      setTab('home');
      Keyboard.dismiss();
      Alert.alert('OK', 'Accesso riuscito!');
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      Alert.alert(
        'Errore',
        msg.includes('email_in_use')
          ? 'Email già registrata.'
          : msg.includes('invalid_credentials')
          ? 'Credenziali non valide.'
          : msg.includes('phone_verification_required')
          ? 'Devi verificare il numero via OTP.'
          : msg.includes('phone_in_use')
          ? 'Numero già usato da troppi account.'
          : msg.includes('phone_accounts_limit')
          ? 'Con questo numero puoi creare massimo 2 account.'
          : msg.includes('email_not_verified')
          ? 'Email non verificata. Apri il link ricevuto per email e poi riprova.'
          : 'Operazione fallita.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const doLogout = async () => {
    setToken(null);
    setTxs([]);
    setImportText('');
    setPwd('');
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(SAVE_KEY);
    Alert.alert('Sei uscito dall’account');
  };

  // ================== ACTIONS (APP) ==================
  const addTx = async () => {
    if (!token) {
      Alert.alert('Devi accedere', 'Fai login o registrazione per usare l’app.');
      return;
    }

    const amount = parseFloat(formAmount.replace(',', '.'));
    if (Number.isNaN(amount) || amount <= 0) {
      Alert.alert('Importo non valido', 'Inserisci un numero maggiore di zero.');
      return;
    }

    const baseTx = {
      type: formType,
      amount,
      category: (formCategory || 'Altro').trim(),
      note: formNote.trim(),
      date: Date.now(),
    };

    try {
      const created = await createTxServer(token, baseTx);
      const newTx: Transaction = { id: created._id, _id: created._id, ...baseTx };
      setTxs(prev => [newTx, ...prev]);
      setFormAmount('');
      setFormCategory('');
      setFormNote('');
      setFormType('entrata');
      setModalOpen(false);
      Keyboard.dismiss();
    } catch {
      Alert.alert('Errore', 'Creazione su server fallita.');
    }
  };

  const deleteTxLocalServer = (item: Transaction) => {
    Alert.alert(
      'Eliminare movimento?',
      `${item.type === 'entrata' ? 'Entrata' : 'Uscita'} ${fmtMoney(item.amount)} • ${item.category}`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            setTxs(prev => prev.filter(t => t.id !== item.id));
            if (token && item._id) {
              try {
                await deleteTxServer(token, item._id);
              } catch {
                // opzionale: ripristino
              }
            }
          },
        },
      ]
    );
  };

  const doServerExport = async () => {
    if (!token) {
      Alert.alert('Devi essere loggato');
      return;
    }
    try {
      const data = await exportFromServer(token);
      setImportText(JSON.stringify(data, null, 2));
      Alert.alert('Export pronto', 'JSON copiato nell’area di testo sotto.');
    } catch {
      Alert.alert('Errore', 'Export fallito');
    }
  };

  const doServerImport = async () => {
    if (!token) {
      Alert.alert('Devi essere loggato');
      return;
    }
    try {
      const obj = JSON.parse(importText);
      await importToServer(token, { txs: obj.txs ?? [] });
      await syncFromServer(token);
      Keyboard.dismiss();
      Alert.alert('Import completato');
    } catch {
      Alert.alert('Errore', 'JSON non valido o import fallito');
    }
  };

  // ================== LAYOUT TWEAKS ==================
  const HEADER_DROP = rs(10);
  const FAB_BOTTOM = rs(10) + (insets.bottom || 0);

  // ✅ Wrapper tastiera “no overlap”
  const KAV_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';
  // offset più aggressivo per evitare coperture su iPhone con notch + header
  const KAV_OFFSET = Platform.OS === 'ios' ? (insets.top || 0) + rs(44) : 0;

  // ================== GATE: BOOT / AUTH FIRST ==================
  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar
          barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
          backgroundColor={COLORS.bg}
          translucent={false}
        />
        <View style={{ alignItems: 'center', rowGap: rs(10) }}>
          <View
            style={{
              width: rs(56),
              height: rs(56),
              borderRadius: rs(18),
              backgroundColor: COLORS.card,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: COLORS.cardBr,
            }}
          >
            <MaterialCommunityIcons name="chart-donut-variant" size={rs(28)} color={COLORS.yellow} />
          </View>
          <Text style={{ color: COLORS.text, fontWeight: '800', fontSize: fs(18) }}>CashFlow</Text>
          <ActivityIndicator color={COLORS.blue} />
        </View>
      </View>
    );
  }

  // ================== LOGIN / REGISTER ONLY (NO TOKEN) ==================
  if (!token) {
    const showOtp = authMode === 'register';

    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR} keyboardVerticalOffset={KAV_OFFSET}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            <StatusBar
              barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
              backgroundColor={COLORS.bg}
              translucent={false}
            />
            <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.bg }}>
              <View
                style={{
                  paddingTop: HEADER_DROP,
                  paddingHorizontal: rs(16),
                  paddingBottom: rs(8),
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: rs(8) }}>
                  <MaterialCommunityIcons name="chart-donut-variant" size={rs(20)} color={COLORS.yellow} />
                  <Text style={{ color: COLORS.text, fontSize: fs(16), fontWeight: '700', letterSpacing: 0.4 }}>
                    CashFlow
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Cambia tema"
                  onPress={() => setThemeMode(m => (m === 'system' ? 'light' : m === 'light' ? 'dark' : 'system'))}
                  style={{
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: COLORS.cardBr,
                    backgroundColor: COLORS.card,
                    padding: rs(8),
                    borderRadius: rs(12),
                  }}
                >
                  <Ionicons
                    name={themeMode === 'system' ? 'sync-outline' : themeMode === 'light' ? 'sunny-outline' : 'moon-outline'}
                    size={rs(18)}
                    color={COLORS.text}
                  />
                </TouchableOpacity>
              </View>
            </SafeAreaView>

            <ScrollView
              ref={loginScrollRef}
              contentContainerStyle={{ padding: rs(16), paddingBottom: (insets.bottom || 0) + rs(28) }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              automaticallyAdjustKeyboardInsets
            >
              <View style={{ alignItems: 'center', marginTop: rs(10), marginBottom: rs(14) }}>
                <View
                  style={{
                    width: rs(72),
                    height: rs(72),
                    borderRadius: rs(22),
                    backgroundColor: COLORS.card,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: COLORS.cardBr,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="chart-donut-variant" size={rs(34)} color={COLORS.yellow} />
                </View>
                <Text style={{ color: COLORS.text, fontWeight: '900', fontSize: fs(22), marginTop: rs(10) }}>
                  CashFlow
                </Text>
                <Text style={{ color: COLORS.subtext, fontSize: fs(12), marginTop: rs(6), textAlign: 'center' }}>
                  Accedi o registrati. Per registrarti serve OTP + verifica email (link via mail).
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: COLORS.card,
                  borderColor: COLORS.cardBr,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: rs(16),
                  padding: rs(14),
                }}
              >
                <View style={{ flexDirection: 'row', marginBottom: rs(10) }}>
                  <TouchableOpacity
                    onPress={() => setAuthMode('login')}
                    style={{
                      flex: 1,
                      padding: rs(10),
                      borderBottomWidth: 2,
                      borderBottomColor: authMode === 'login' ? COLORS.blue : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: COLORS.text, fontWeight: '800' }}>Accedi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setAuthMode('register')}
                    style={{
                      flex: 1,
                      padding: rs(10),
                      borderBottomWidth: 2,
                      borderBottomColor: authMode === 'register' ? COLORS.blue : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: COLORS.text, fontWeight: '800' }}>Registrati</Text>
                  </TouchableOpacity>
                </View>

                {/* EMAIL */}
                <View
                  style={{
                    backgroundColor: COLORS.cardBr,
                    borderRadius: rs(12),
                    paddingHorizontal: rs(12),
                    paddingVertical: Platform.OS === 'ios' ? rs(12) : rs(8),
                    marginBottom: rs(10),
                  }}
                >
                  <TextInput
                    ref={emailRef}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor={COLORS.subtext}
                    style={{ color: COLORS.text }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={() => pwdRef.current?.focus()}
                    onFocus={(e) => scrollToInput(loginScrollRef, e.nativeEvent.layout?.y ?? 0)}
                  />
                </View>

                {/* PASSWORD */}
                <View
                  style={{
                    backgroundColor: COLORS.cardBr,
                    borderRadius: rs(12),
                    paddingHorizontal: rs(12),
                    paddingVertical: Platform.OS === 'ios' ? rs(12) : rs(8),
                    marginBottom: rs(12),
                  }}
                >
                  <TextInput
                    ref={pwdRef}
                    value={pwd}
                    onChangeText={setPwd}
                    placeholder="Password"
                    placeholderTextColor={COLORS.subtext}
                    style={{ color: COLORS.text }}
                    secureTextEntry
                    returnKeyType={showOtp ? 'next' : 'done'}
                    onSubmitEditing={() => {
                      if (showOtp) phoneRef.current?.focus();
                      else doAuth();
                    }}
                  />
                </View>

                {/* OTP BLOCK (solo register) */}
                {showOtp && (
                  <View style={{ marginBottom: rs(12) }}>
                    <Text style={{ color: COLORS.subtext, fontSize: fs(12), marginBottom: rs(8) }}>
                      Verifica telefono (OTP)
                    </Text>

                    <View
                      style={{
                        backgroundColor: COLORS.cardBr,
                        borderRadius: rs(12),
                        paddingHorizontal: rs(12),
                        paddingVertical: Platform.OS === 'ios' ? rs(12) : rs(8),
                        marginBottom: rs(10),
                      }}
                    >
                      <TextInput
                        ref={phoneRef}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="+393331112233"
                        placeholderTextColor={COLORS.subtext}
                        style={{ color: COLORS.text }}
                        keyboardType="phone-pad"
                        autoCapitalize="none"
                        returnKeyType="done"
                      />
                    </View>

                    <TouchableOpacity
                      onPress={doSendOtp}
                      disabled={otpBusy}
                      style={{
                        backgroundColor: COLORS.blue,
                        borderRadius: rs(12),
                        paddingVertical: rs(10),
                        alignItems: 'center',
                        opacity: otpBusy ? 0.7 : 1,
                        marginBottom: rs(10),
                      }}
                    >
                      <Text style={{ color: DARK.bg, fontWeight: '900' }}>
                        {otpBusy ? 'Invio…' : otpSent ? 'Reinvia OTP' : 'Invia OTP'}
                      </Text>
                    </TouchableOpacity>

                    {otpSent && (
                      <>
                        <View
                          style={{
                            backgroundColor: COLORS.cardBr,
                            borderRadius: rs(12),
                            paddingHorizontal: rs(12),
                            paddingVertical: Platform.OS === 'ios' ? rs(12) : rs(8),
                            marginBottom: rs(10),
                          }}
                        >
                          <TextInput
                            ref={otpRef}
                            value={otp}
                            onChangeText={setOtp}
                            placeholder="Codice OTP"
                            placeholderTextColor={COLORS.subtext}
                            style={{ color: COLORS.text }}
                            keyboardType="number-pad"
                            autoCapitalize="none"
                            returnKeyType="done"
                            onSubmitEditing={doVerifyOtp}
                          />
                        </View>

                        <TouchableOpacity
                          onPress={doVerifyOtp}
                          disabled={otpBusy}
                          style={{
                            backgroundColor: otpVerified ? COLORS.green : COLORS.yellow,
                            borderRadius: rs(12),
                            paddingVertical: rs(10),
                            alignItems: 'center',
                            opacity: otpBusy ? 0.7 : 1,
                          }}
                        >
                          <Text style={{ color: scheme === 'dark' ? DARK.bg : LIGHT.bg, fontWeight: '900' }}>
                            {otpBusy ? 'Verifica…' : otpVerified ? 'Numero verificato ✅' : 'Verifica OTP'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}

                {/* CTA */}
                <TouchableOpacity
                  onPress={doAuth}
                  disabled={authBusy}
                  style={{
                    backgroundColor: COLORS.yellow,
                    borderRadius: rs(12),
                    paddingVertical: rs(12),
                    alignItems: 'center',
                    marginBottom: rs(12),
                    opacity:
                      authBusy || (authMode === 'register' && (!otpVerified || !phoneProofToken)) ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: scheme === 'dark' ? DARK.bg : LIGHT.bg, fontWeight: '900', fontSize: fs(15) }}>
                    {authBusy ? 'Attendi…' : authMode === 'login' ? 'Accedi' : 'Crea account'}
                  </Text>
                </TouchableOpacity>

                {/* Google */}
                <TouchableOpacity
                  disabled={!request || authBusy}
                  onPress={() => promptAsync({ useProxy: true })}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: rs(12),
                    paddingVertical: rs(12),
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    columnGap: rs(8),
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: COLORS.cardBr,
                    opacity: request && !authBusy ? 1 : 0.6,
                  }}
                >
                  <Ionicons name="logo-google" size={rs(18)} color="#4285F4" />
                  <Text style={{ color: '#111827', fontWeight: '800' }}>Continua con Google</Text>
                </TouchableOpacity>

                <Text style={{ color: COLORS.subtext, marginTop: rs(10), fontSize: fs(11), textAlign: 'center' }}>
                  Registrazione: OTP + verifica email. Google: entra solo se account già esistente e verificato.
                </Text>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  // ================== UI (APP LOGGATA) ==================
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={COLORS.bg}
        translucent={false}
      />

      {/* HEADER */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.bg }}>
        <View
          style={{
            paddingTop: HEADER_DROP,
            paddingHorizontal: rs(16),
            paddingBottom: rs(8),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: rs(8) }}>
            <MaterialCommunityIcons name="chart-donut-variant" size={rs(20)} color={COLORS.yellow} />
            <Text style={{ color: COLORS.text, fontSize: fs(16), fontWeight: '700', letterSpacing: 0.4 }}>
              CashFlow
            </Text>
            {isLoadingSync && <Text style={{ color: COLORS.subtext, marginLeft: rs(8) }}>↻ sync…</Text>}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Cambia tema"
            onPress={() => setThemeMode(m => (m === 'system' ? 'light' : m === 'light' ? 'dark' : 'system'))}
            style={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: COLORS.cardBr,
              backgroundColor: COLORS.card,
              padding: rs(8),
              borderRadius: rs(12),
            }}
          >
            <Ionicons
              name={themeMode === 'system' ? 'sync-outline' : themeMode === 'light' ? 'sunny-outline' : 'moon-outline'}
              size={rs(18)}
              color={COLORS.text}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ---------------- HOME ---------------- */}
      {tab === 'home' && (
        <ScrollView
          contentContainerStyle={{ padding: rs(16), paddingTop: rs(18), paddingBottom: rs(100) }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <SummaryCard
            title="Saldo"
            value={fmtMoney(saldo)}
            icon={saldo >= 0 ? 'trending-up' : 'trending-down'}
            color={saldo >= 0 ? COLORS.green : COLORS.red}
            subtitle={saldo >= 0 ? 'In guadagno' : 'In perdita'}
            COLORS={COLORS}
            rs={rs}
            fs={fs}
          />
          <View style={{ flexDirection: 'row', gap: rs(12), marginTop: rs(12) }}>
            <MiniCard
              title="Entrate"
              value={fmtMoney(totalEntrate)}
              color={COLORS.green}
              icon="arrow-down-left"
              COLORS={COLORS}
              rs={rs}
              fs={fs}
            />
            <MiniCard
              title="Uscite"
              value={fmtMoney(totalUscite)}
              color={COLORS.red}
              icon="arrow-up-right"
              COLORS={COLORS}
              rs={rs}
              fs={fs}
            />
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderColor: COLORS.cardBr,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: rs(16),
              padding: rs(16),
              marginTop: rs(12),
            }}
          >
            <Text style={{ color: COLORS.text, fontWeight: '700', marginBottom: rs(12), fontSize: fs(15) }}>
              Ultimi 7 giorni
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              {last7DaysChart.map((d, idx) => (
                <View key={idx} style={{ alignItems: 'center', width: `${100 / 7}%` }}>
                  <View style={{ width: rs(10), height: rs(64) * d.posH, borderRadius: 999, backgroundColor: COLORS.green }} />
                  <View style={{ height: rs(6) }} />
                  <View style={{ width: rs(10), height: rs(64) * d.negH, borderRadius: 999, backgroundColor: COLORS.red }} />
                  <Text style={{ color: COLORS.subtext, fontSize: fs(10), marginTop: rs(8) }}>{d.label}</Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: rs(10), flexDirection: 'row', columnGap: rs(16) }}>
              <LegendDot color={COLORS.green} label="Entrate" COLORS={COLORS} fs={fs} rs={rs} />
              <LegendDot color={COLORS.red} label="Uscite" COLORS={COLORS} fs={fs} rs={rs} />
            </View>
          </View>

          <Text style={{ color: COLORS.text, fontWeight: '700', marginTop: rs(16), marginBottom: rs(8), fontSize: fs(15) }}>
            Ultimi movimenti
          </Text>

          {txs.slice(0, 5).map(item => (
            <Pressable
              key={item.id}
              onLongPress={() => deleteTxLocalServer(item)}
              style={{
                backgroundColor: COLORS.card,
                borderColor: COLORS.cardBr,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: rs(14),
                padding: rs(14),
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: rs(10),
                columnGap: rs(12),
              }}
            >
              <View
                style={{
                  width: rs(30),
                  height: rs(30),
                  borderRadius: rs(10),
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: item.type === 'entrata' ? COLORS.green : COLORS.red,
                }}
              >
                <Ionicons
                  name={item.type === 'entrata' ? 'arrow-down-left' : 'arrow-up-right'}
                  size={rs(16)}
                  color={scheme === 'dark' ? DARK.bg : LIGHT.bg}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: fs(14) }}>{item.category}</Text>
                <Text style={{ color: COLORS.subtext, fontSize: fs(12), marginTop: rs(2) }} numberOfLines={1}>
                  {item.note ? item.note : '—'} • {niceDate(item.date)}
                </Text>
              </View>
              <Text style={{ fontWeight: '800', fontSize: fs(14), color: item.type === 'entrata' ? COLORS.green : COLORS.red }}>
                {item.type === 'entrata' ? '+' : '-'}
                {fmtMoney(item.amount)}
              </Text>
            </Pressable>
          ))}
          {txs.length === 0 && <Text style={{ color: COLORS.subtext }}>Aggiungi movimenti nella tab “Movimenti” ➜</Text>}
        </ScrollView>
      )}

      {/* ---------------- MOVIMENTI ---------------- */}
      {tab === 'movimenti' && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: rs(16), paddingTop: rs(18), gap: rs(12) }}>
            <View style={{ flexDirection: 'row', columnGap: rs(8), rowGap: rs(8), flexWrap: 'wrap' }}>
              {(['tutte', 'entrata', 'uscita'] as (TxType | 'tutte')[]).map(t => (
                <Pressable
                  key={t}
                  onPress={() => setFilterType(t)}
                  style={[
                    {
                      backgroundColor: COLORS.card,
                      borderColor: COLORS.cardBr,
                      borderWidth: StyleSheet.hairlineWidth,
                      paddingVertical: rs(8),
                      paddingHorizontal: rs(12),
                      borderRadius: 999,
                    },
                    filterType === t && { backgroundColor: COLORS.cardBr },
                  ]}
                >
                  <Text style={{ color: filterType === t ? COLORS.text : COLORS.subtext, fontSize: fs(12), fontWeight: '600' }}>
                    {t === 'tutte' ? 'Tutte' : t === 'entrata' ? 'Entrate' : 'Uscite'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                columnGap: rs(8),
                backgroundColor: COLORS.card,
                borderColor: COLORS.cardBr,
                borderWidth: StyleSheet.hairlineWidth,
                borderRadius: rs(12),
                paddingHorizontal: rs(12),
                paddingVertical: Platform.OS === 'ios' ? rs(10) : rs(6),
              }}
            >
              <Ionicons name="search" size={rs(16)} color={COLORS.subtext} />
              <TextInput
                placeholder="Cerca categoria o nota…"
                placeholderTextColor={COLORS.subtext}
                style={{ color: COLORS.text, flex: 1, paddingVertical: rs(2), fontSize: fs(14) }}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                allowFontScaling
                returnKeyType="search"
              />
            </View>
          </View>

          <FlatList
            data={filtered}
            keyExtractor={i => i.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: rs(16), paddingBottom: rs(140), maxWidth: 900, width: '100%', alignSelf: 'center' }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: rs(28), rowGap: rs(6) }}>
                <Ionicons name="add-circle-outline" size={rs(28)} color={COLORS.subtext} />
                <Text style={{ color: COLORS.subtext, fontSize: fs(13) }}>Nessun movimento ancora.</Text>
                <Text style={{ color: COLORS.subtext, fontSize: fs(12) }}>Tocca “+” per aggiungere il primo 👇</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                onLongPress={() => deleteTxLocalServer(item)}
                style={{
                  backgroundColor: COLORS.card,
                  borderColor: COLORS.cardBr,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: rs(14),
                  padding: rs(14),
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: rs(10),
                  columnGap: rs(12),
                }}
              >
                <View
                  style={{
                    width: rs(30),
                    height: rs(30),
                    borderRadius: rs(10),
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: item.type === 'entrata' ? COLORS.green : COLORS.red,
                  }}
                >
                  <Ionicons
                    name={item.type === 'entrata' ? 'arrow-down-left' : 'arrow-up-right'}
                    size={rs(16)}
                    color={scheme === 'dark' ? DARK.bg : LIGHT.bg}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: fs(14) }}>{item.category}</Text>
                  <Text style={{ color: COLORS.subtext, fontSize: fs(12), marginTop: rs(2) }} numberOfLines={1}>
                    {item.note ? item.note : '—'} • {niceDate(item.date)}
                  </Text>
                </View>
                <Text style={{ fontWeight: '800', fontSize: fs(14), color: item.type === 'entrata' ? COLORS.green : COLORS.red }}>
                  {item.type === 'entrata' ? '+' : '-'}
                  {fmtMoney(item.amount)}
                </Text>
              </Pressable>
            )}
          />

          <TouchableOpacity
            onPress={() => {
              setModalOpen(true);
              setTimeout(() => amountRef.current?.focus(), 250);
            }}
            style={{
              position: 'absolute',
              right: rs(18),
              bottom: FAB_BOTTOM,
              backgroundColor: COLORS.yellow,
              borderRadius: rs(999),
              padding: rs(14),
              elevation: 3,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <Ionicons name="add" size={rs(22)} color={scheme === 'dark' ? DARK.bg : LIGHT.bg} />
          </TouchableOpacity>
        </View>
      )}

      {/* ---------------- GRAFICI ---------------- */}
      {tab === 'grafici' && (
        <ScrollView
          contentContainerStyle={{ padding: rs(16), paddingTop: rs(18), paddingBottom: rs(100) }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <View style={{ backgroundColor: COLORS.card, borderColor: COLORS.cardBr, borderWidth: StyleSheet.hairlineWidth, borderRadius: rs(16), padding: rs(16) }}>
            <Text style={{ color: COLORS.text, fontWeight: '700', marginBottom: rs(12), fontSize: fs(15) }}>Andamento 12 mesi</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              {monthly.map((m, i) => (
                <View key={i} style={{ alignItems: 'center', width: `${100 / 12}%` }}>
                  <View style={{ width: rs(10), height: rs(80) * m.inH, backgroundColor: COLORS.green, borderRadius: 999 }} />
                  <View style={{ height: rs(6) }} />
                  <View style={{ width: rs(10), height: rs(80) * m.outH, backgroundColor: COLORS.red, borderRadius: 999 }} />
                  <Text style={{ color: COLORS.subtext, fontSize: fs(9), marginTop: rs(6) }}>{m.label}</Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: rs(10), flexDirection: 'row', columnGap: rs(16) }}>
              <LegendDot color={COLORS.green} label="Entrate" COLORS={COLORS} fs={fs} rs={rs} />
              <LegendDot color={COLORS.red} label="Uscite" COLORS={COLORS} fs={fs} rs={rs} />
            </View>
          </View>

          <View style={{ backgroundColor: COLORS.card, borderColor: COLORS.cardBr, borderWidth: StyleSheet.hairlineWidth, borderRadius: rs(16), padding: rs(16), marginTop: rs(12) }}>
            <Text style={{ color: COLORS.text, fontWeight: '700', marginBottom: rs(12), fontSize: fs(15) }}>Top categorie</Text>
            {byCategory.length === 0 && <Text style={{ color: COLORS.subtext }}>Nessun dato disponibile.</Text>}
            {byCategory.map((c, idx) => (
              <View key={idx} style={{ marginBottom: rs(10) }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: COLORS.text, fontWeight: '600' }}>
                    {c.category} {c.type === 'entrata' ? '↑' : '↓'}
                  </Text>
                  <Text style={{ color: COLORS.subtext }}>{fmtMoney(c.total)}</Text>
                </View>
                <View style={{ height: rs(8), backgroundColor: COLORS.cardBr, borderRadius: rs(8), marginTop: rs(6), overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(100, Math.round(c.pct * 100))}%`, backgroundColor: c.type === 'entrata' ? COLORS.green : COLORS.red, height: '100%' }} />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ---------------- IMPOSTAZIONI ---------------- */}
      {tab === 'impostazioni' && (
        <ScrollView
          contentContainerStyle={{ padding: rs(16), paddingTop: rs(18), paddingBottom: rs(100) }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: fs(16), marginBottom: rs(12) }}>Impostazioni</Text>

          <View style={{ backgroundColor: COLORS.card, borderColor: COLORS.cardBr, borderWidth: StyleSheet.hairlineWidth, borderRadius: rs(14), padding: rs(14), marginBottom: rs(12) }}>
            <Text style={{ color: COLORS.subtext, marginBottom: rs(8) }}>Tema</Text>
            {(['system', 'light', 'dark'] as ThemeMode[]).map(m => (
              <Pressable
                key={m}
                onPress={() => setThemeMode(m)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: rs(8) }}
              >
                <Text style={{ color: COLORS.text }}>{m === 'system' ? 'Sistema' : m === 'light' ? 'Chiaro' : 'Scuro'}</Text>
                {themeMode === m ? (
                  <Ionicons name="checkmark-circle" size={rs(18)} color={COLORS.blue} />
                ) : (
                  <Ionicons name="ellipse-outline" size={rs(18)} color={COLORS.subtext} />
                )}
              </Pressable>
            ))}
          </View>

          <View style={{ backgroundColor: COLORS.card, borderColor: COLORS.cardBr, borderWidth: StyleSheet.hairlineWidth, borderRadius: rs(14), padding: rs(14) }}>
            <Text style={{ color: COLORS.subtext, marginBottom: rs(8) }}>Cache locale</Text>
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Svuotare la cache locale?', 'I dati reali restano sul server. La cache verrà ricreata alla prossima sincronizzazione.', [
                  { text: 'Annulla', style: 'cancel' },
                  {
                    text: 'Svuota',
                    style: 'destructive',
                    onPress: async () => {
                      setTxs([]);
                      await AsyncStorage.removeItem(SAVE_KEY);
                      if (token) await syncFromServer(token);
                    },
                  },
                ]);
              }}
              style={{ backgroundColor: COLORS.red, borderRadius: rs(10), paddingVertical: rs(10), alignItems: 'center' }}
            >
              <Text style={{ color: DARK.bg, fontWeight: '800' }}>Svuota cache movimenti</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ---------------- ACCOUNT ---------------- */}
      {tab === 'account' && (
        <ScrollView
          contentContainerStyle={{ padding: rs(16), paddingTop: rs(18), paddingBottom: rs(100) }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={{ color: COLORS.text, fontWeight: '700', fontSize: fs(16), marginBottom: rs(12) }}>Account</Text>

          <View style={{ backgroundColor: COLORS.card, borderColor: COLORS.cardBr, borderWidth: StyleSheet.hairlineWidth, borderRadius: rs(14), padding: rs(14), marginBottom: rs(12) }}>
            <Text style={{ color: COLORS.text, fontWeight: '700' }}>Loggato come {email || 'utente'}</Text>
            <View style={{ flexDirection: 'row', columnGap: rs(8), marginTop: rs(10) }}>
              <TouchableOpacity
                onPress={() => token && syncFromServer(token)}
                style={{ backgroundColor: COLORS.blue, paddingVertical: rs(10), paddingHorizontal: rs(12), borderRadius: rs(10) }}
              >
                <Text style={{ color: DARK.bg, fontWeight: '800' }}>Sincronizza</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doLogout}
                style={{ backgroundColor: COLORS.cardBr, paddingVertical: rs(10), paddingHorizontal: rs(12), borderRadius: rs(10) }}
              >
                <Text style={{ color: COLORS.text }}>Esci</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ backgroundColor: COLORS.card, borderColor: COLORS.cardBr, borderWidth: StyleSheet.hairlineWidth, borderRadius: rs(14), padding: rs(14) }}>
            <Text style={{ color: COLORS.subtext, marginBottom: rs(8) }}>Backup/Import (server)</Text>
            <View style={{ flexDirection: 'row', columnGap: rs(8) }}>
              <TouchableOpacity
                onPress={doServerExport}
                style={{ flex: 1, backgroundColor: COLORS.blue, borderRadius: rs(10), paddingVertical: rs(10), alignItems: 'center' }}
              >
                <Text style={{ color: DARK.bg, fontWeight: '800' }}>Esporta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={doServerImport}
                style={{ flex: 1, backgroundColor: COLORS.green, borderRadius: rs(10), paddingVertical: rs(10), alignItems: 'center' }}
              >
                <Text style={{ color: DARK.bg, fontWeight: '800' }}>Importa</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={importText}
              onChangeText={setImportText}
              placeholder='{"txs":[...]}'
              placeholderTextColor={COLORS.subtext}
              style={{ color: COLORS.text, minHeight: rs(140), textAlignVertical: 'top', marginTop: rs(10) }}
              multiline
            />
          </View>
        </ScrollView>
      )}

      {/* ---------------- BOTTOM TAB BAR ---------------- */}
      <SafeAreaView edges={['bottom']} style={{ backgroundColor: COLORS.bg }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingBottom: insets.bottom ? rs(6) : rs(10),
            paddingTop: rs(6),
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: COLORS.cardBr,
          }}
        >
          {renderTab('home', 'Home', 'home-outline', tab, setTab, COLORS, rs, fs)}
          {renderTab('movimenti', 'Movimenti', 'list-outline', tab, setTab, COLORS, rs, fs)}
          {renderTab('grafici', 'Grafici', 'bar-chart-outline', tab, setTab, COLORS, rs, fs)}
          {renderTab('impostazioni', 'Impostazioni', 'settings-outline', tab, setTab, COLORS, rs, fs)}
          {renderTab('account', 'Account', 'person-circle-outline', tab, setTab, COLORS, rs, fs)}
        </View>
      </SafeAreaView>

      {/* ---------------- MODAL NUOVO MOVIMENTO ---------------- */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR} keyboardVerticalOffset={KAV_OFFSET}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' }}>
              <View
                style={{
                  backgroundColor: COLORS.bg,
                  borderTopLeftRadius: rs(16),
                  borderTopRightRadius: rs(16),
                  borderColor: COLORS.cardBr,
                  borderTopWidth: StyleSheet.hairlineWidth,
                }}
              >
                <ScrollView
                  ref={modalScrollRef}
                  contentContainerStyle={{ padding: rs(16), paddingBottom: (insets.bottom || 0) + rs(18), rowGap: rs(12) }}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  automaticallyAdjustKeyboardInsets
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: COLORS.text, fontSize: fs(16), fontWeight: '800' }}>Nuovo movimento</Text>
                    <TouchableOpacity
                      onPress={() => setModalOpen(false)}
                      style={{
                        padding: rs(8),
                        backgroundColor: COLORS.card,
                        borderRadius: rs(10),
                        borderColor: COLORS.cardBr,
                        borderWidth: StyleSheet.hairlineWidth,
                      }}
                    >
                      <Ionicons name="close" size={rs(18)} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: 'row', columnGap: rs(8) }}>
                    {(['entrata', 'uscita'] as TxType[]).map(t => (
                      <Pressable
                        key={t}
                        onPress={() => setFormType(t)}
                        style={[
                          {
                            flex: 1,
                            backgroundColor: COLORS.card,
                            borderColor: COLORS.cardBr,
                            borderWidth: StyleSheet.hairlineWidth,
                            paddingVertical: rs(10),
                            borderRadius: rs(12),
                            alignItems: 'center',
                          },
                          formType === t && { backgroundColor: t === 'entrata' ? COLORS.green : COLORS.red },
                        ]}
                      >
                        <Text
                          style={{
                            color: formType === t ? (scheme === 'dark' ? DARK.bg : LIGHT.bg) : COLORS.text,
                            fontWeight: '700',
                            fontSize: fs(14),
                          }}
                        >
                          {t === 'entrata' ? 'Entrata' : 'Uscita'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={{ rowGap: rs(6) }}>
                    <Text style={{ color: COLORS.subtext, fontSize: fs(12) }}>Importo</Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        columnGap: rs(8),
                        alignItems: 'center',
                        backgroundColor: COLORS.card,
                        borderColor: COLORS.cardBr,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderRadius: rs(12),
                        paddingHorizontal: rs(12),
                        paddingVertical: Platform.OS === 'ios' ? rs(12) : rs(8),
                      }}
                    >
                      <Ionicons name="cash-outline" size={rs(16)} color={COLORS.subtext} />
                      <TextInput
                        ref={amountRef}
                        value={formAmount}
                        onChangeText={setFormAmount}
                        keyboardType="decimal-pad"
                        placeholder="0,00"
                        placeholderTextColor={COLORS.subtext}
                        style={{ color: COLORS.text, flex: 1, paddingVertical: rs(2), fontSize: fs(14) }}
                        allowFontScaling
                        returnKeyType="next"
                        onSubmitEditing={() => {
                          // prova a portare in basso e far vedere il prossimo campo
                          requestAnimationFrame(() => modalScrollRef.current?.scrollToEnd({ animated: true }));
                          setTimeout(() => noteRef.current?.focus(), 150);
                        }}
                      />
                    </View>
                  </View>

                  <View style={{ rowGap: rs(6) }}>
                    <Text style={{ color: COLORS.subtext, fontSize: fs(12) }}>Categoria</Text>
                    <CategoryPicker value={formCategory} onSelect={setFormCategory} type={formType} COLORS={COLORS} rs={rs} fs={fs} />
                  </View>

                  <View style={{ rowGap: rs(6) }}>
                    <Text style={{ color: COLORS.subtext, fontSize: fs(12) }}>Nota (opzionale)</Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        columnGap: rs(8),
                        alignItems: 'center',
                        backgroundColor: COLORS.card,
                        borderColor: COLORS.cardBr,
                        borderWidth: StyleSheet.hairlineWidth,
                        borderRadius: rs(12),
                        paddingHorizontal: rs(12),
                        paddingVertical: Platform.OS === 'ios' ? rs(12) : rs(8),
                      }}
                    >
                      <Ionicons name="create-outline" size={rs(16)} color={COLORS.subtext} />
                      <TextInput
                        ref={noteRef}
                        value={formNote}
                        onChangeText={setFormNote}
                        placeholder="Aggiungi un promemoria…"
                        placeholderTextColor={COLORS.subtext}
                        style={{ color: COLORS.text, flex: 1, paddingVertical: rs(2), fontSize: fs(14) }}
                        allowFontScaling
                        returnKeyType="done"
                        onFocus={() => requestAnimationFrame(() => modalScrollRef.current?.scrollToEnd({ animated: true }))}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={addTx}
                    style={{ marginTop: rs(4), backgroundColor: COLORS.yellow, borderRadius: rs(12), paddingVertical: rs(12), alignItems: 'center' }}
                  >
                    <Text style={{ color: scheme === 'dark' ? DARK.bg : LIGHT.bg, fontWeight: '800', fontSize: fs(16) }}>
                      Aggiungi
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ================== TAB BUTTON ==================
function renderTab(
  key: TabKey,
  label: string,
  icon: keyof typeof Ionicons.glyphMap,
  active: TabKey,
  setActive: (k: TabKey) => void,
  COLORS: typeof LIGHT,
  rs: (n: number) => number,
  fs: (n: number) => number
) {
  const focused = active === key;
  return (
    <TouchableOpacity accessibilityRole="button" onPress={() => setActive(key)} style={{ alignItems: 'center', paddingHorizontal: rs(6) }}>
      <Ionicons name={icon} size={rs(20)} color={focused ? COLORS.text : COLORS.subtext} />
      <Text style={{ color: focused ? COLORS.text : COLORS.subtext, fontSize: fs(10), marginTop: rs(2) }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ================== UI SUB-COMPONENTS ==================
function SummaryCard({
  title,
  value,
  icon,
  color,
  subtitle,
  COLORS,
  rs,
  fs,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  subtitle?: string;
  COLORS: typeof LIGHT;
  rs: (n: number) => number;
  fs: (n: number) => number;
}) {
  return (
    <View style={{ backgroundColor: COLORS.card, borderColor: COLORS.cardBr, borderWidth: StyleSheet.hairlineWidth, borderRadius: rs(16), padding: rs(16) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(6) }}>
        <Text style={{ color: COLORS.subtext, fontSize: fs(13), letterSpacing: 0.3 }}>{title}</Text>
        <View style={{ padding: rs(8), borderRadius: rs(12), backgroundColor: color }}>
          <Ionicons name={icon} size={rs(16)} color={'#0E1116'} />
        </View>
      </View>
      <Text style={{ fontSize: fs(28), fontWeight: '800', marginTop: rs(2), color }}>{value}</Text>
      {subtitle ? <Text style={{ color: COLORS.subtext, marginTop: rs(4), fontSize: fs(12) }}>{subtitle}</Text> : null}
    </View>
  );
}

function MiniCard({
  title,
  value,
  color,
  icon,
  COLORS,
  rs,
  fs,
}: {
  title: string;
  value: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  COLORS: typeof LIGHT;
  rs: (n: number) => number;
  fs: (n: number) => number;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.card, borderColor: COLORS.cardBr, borderWidth: StyleSheet.hairlineWidth, borderRadius: rs(16), padding: rs(14) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: rs(8), marginBottom: rs(2) }}>
        <View style={{ padding: rs(6), borderRadius: rs(10), backgroundColor: color }}>
          <Ionicons name={icon} size={rs(14)} color={'#0E1116'} />
        </View>
        <Text style={{ color: COLORS.subtext, fontSize: fs(12) }}>{title}</Text>
      </View>
      <Text style={{ fontSize: fs(18), fontWeight: '700', marginTop: rs(4), color }}>{value}</Text>
    </View>
  );
}

function LegendDot({
  color,
  label,
  COLORS,
  rs,
  fs,
}: {
  color: string;
  label: string;
  COLORS: typeof LIGHT;
  rs: (n: number) => number;
  fs: (n: number) => number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: rs(6) }}>
      <View style={{ width: rs(8), height: rs(8), borderRadius: rs(8), backgroundColor: color }} />
      <Text style={{ color: COLORS.subtext, fontSize: fs(12) }}>{label}</Text>
    </View>
  );
}

function CategoryPicker({
  value,
  onSelect,
  type,
  COLORS,
  rs,
  fs,
}: {
  value: string;
  onSelect: (v: string) => void;
  type: TxType;
  COLORS: typeof LIGHT;
  rs: (n: number) => number;
  fs: (n: number) => number;
}) {
  const cats = CATEGORIES[type];
  return (
    <View style={{ rowGap: rs(8) }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: rs(8), rowGap: rs(8) }}>
        {cats.map(c => {
          const active = value === c;
          return (
            <Pressable
              key={c}
              onPress={() => onSelect(c)}
              style={[
                {
                  backgroundColor: COLORS.card,
                  borderColor: COLORS.cardBr,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: 999,
                  paddingHorizontal: rs(12),
                  paddingVertical: rs(8),
                },
                active && { backgroundColor: COLORS.cardBr },
              ]}
            >
              <Text style={{ color: active ? COLORS.text : COLORS.subtext, fontSize: fs(12), fontWeight: '600' }}>{c}</Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          flexDirection: 'row',
          columnGap: rs(8),
          alignItems: 'center',
          backgroundColor: COLORS.card,
          borderColor: COLORS.cardBr,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: rs(12),
          paddingHorizontal: rs(12),
          paddingVertical: Platform.OS === 'ios' ? rs(12) : rs(8),
        }}
      >
        <Ionicons name="pricetag-outline" size={rs(16)} color={COLORS.subtext} />
        <TextInput
          value={value}
          onChangeText={onSelect}
          placeholder="Oppure scrivi una nuova categoria…"
          placeholderTextColor={COLORS.subtext}
          style={{ color: COLORS.text, flex: 1, paddingVertical: rs(2), fontSize: fs(14) }}
          allowFontScaling
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({});
