// Supabase configuration
const SUPABASE_URL = 'https://YOUR_SUPABASE_URL.supabase.co'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your Supabase anon key

// Initialize Supabase client
let supabase;

async function initSupabase() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabase;
}

// Ensure supabase is initialized
async function getSupabase() {
  if (!supabase) {
    await initSupabase();
  }
  return supabase;
}

export async function requireAuth() {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    window.location.href = '/login.html';
    return null;
  }

  return session;
}

export async function signOut() {
  const sb = await getSupabase();
  await sb.auth.signOut();
  window.location.href = '/login.html';
}

export async function getSession() {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

export { getSupabase as supabase };
