import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hxbkqbvmyrfggkoybugz.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YmtxYnZteXJmZ2drb3lidWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDQ1ODQsImV4cCI6MjA4NTkyMDU4NH0.aWEsnWOnddpDGlK1UjpBrscAxj900uUpX3QRyRvaSUs";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
