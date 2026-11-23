/* Public browser config for exam-classroom-system.
 * Google OAuth requires provider setup in Supabase and verified Google Cloud OAuth client.
 * Do NOT enable until the provider, redirect URL and test teacher accounts work.
 * publishableKey is public; NEVER put a Supabase secret/service_role key here.
 */
window.EXAM_CLOUD_CONFIG = {
  enabled: true,
  url: "https://sbdygqnhawjonvdktqly.supabase.co",
  publishableKey: "sb_publishable_KE4297JKc-AZz-Rw3V4ChQ_TXbJSy6H",
  allowEmailLogin: false
};
